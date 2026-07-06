// Release-gate smoke test: run against a real terminal-bridge + real kind
// cluster (see .github/workflows/release.yml). Not the full regression suite
// (that's scripts/dev/e2e-live-exercises.mjs) — just enough to prove the
// exact integration path that broke before (DEBUG_TERMINAL_CONNECTION.md):
// WS connects, a real shell runs kubectl against the real cluster, and a
// real checker function reports pass/fail against real cluster state.
import WebSocket from "ws";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KC = process.env.KUBECONFIG ?? `${REPO}/.kubeconfig`;
const WS_URL = "ws://127.0.0.1:3001/term";

function k(...args) {
  return execFileSync("kubectl", ["--kubeconfig", KC, ...args], {
    encoding: "utf8",
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(exerciseId) {
  return new Promise((resolve, reject) => {
    const url = exerciseId ? `${WS_URL}?exercise=${exerciseId}` : WS_URL;
    const ws = new WebSocket(url, { origin: "http://localhost:3000" });
    const timer = setTimeout(() => reject(new Error("ready timeout")), 120000);
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString());
      if (msg.type === "ready") {
        clearTimeout(timer);
        resolve({ ws, namespace: msg.namespace });
      } else if (msg.type === "error") {
        clearTimeout(timer);
        reject(new Error(`bridge error: ${msg.message}`));
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function checkOnce(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("check timeout")), 30000);
    const onMsg = (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString());
      if (msg.type === "check-result") {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(msg.result);
      }
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ type: "check" }));
  });
}

async function pollPass(ws, label, timeoutMs = 120000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await checkOnce(ws);
    if (last.passed) return last;
    await sleep(3000);
  }
  throw new Error(`${label}: never passed. Last feedback: ${last?.feedback}`);
}

async function shellSmoke() {
  console.log("[smoke] part A: raw kubectl get nodes over the WS shell");
  const { ws } = await connect();

  let buf = "";
  let idleTimer = null;
  const done = new Promise((resolve, reject) => {
    const hardTimeout = setTimeout(() => reject(new Error("shell smoke: overall timeout")), 60000);
    ws.on("message", (data, isBinary) => {
      if (!isBinary) return;
      buf += data.toString();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        clearTimeout(hardTimeout);
        resolve();
      }, 2000);
    });
  });

  ws.send(Buffer.from("kubectl get nodes\n"));
  await done;
  ws.close();

  const clean = stripAnsi(buf);
  for (const node of ["cka-trainer-control-plane", "cka-trainer-worker", "cka-trainer-worker2"]) {
    const re = new RegExp(`${node}\\s+Ready`);
    if (!re.test(clean)) {
      console.error("[smoke] captured output:\n" + clean);
      throw new Error(`shell smoke: expected "${node}" Ready in kubectl output`);
    }
  }
  console.log("[smoke] part A: OK — all 3 nodes Ready via real kubectl over the bridge");
}

async function checkerSmoke() {
  console.log("[smoke] part B: real checker against sn-ex-expose");
  const { ws, namespace: ns } = await connect("sn-ex-expose");

  const preResult = await checkOnce(ws);
  if (preResult.passed) {
    throw new Error("sn-ex-expose: checker reported passed=true before the exercise was solved");
  }

  k("-n", ns, "expose", "deployment", "frontend", "--name=frontend-svc",
    "--port=80", "--target-port=8080");

  const result = await pollPass(ws, "sn-ex-expose");
  if (!result.passed) {
    throw new Error(`sn-ex-expose: expected passed=true, got feedback: ${result.feedback}`);
  }

  ws.close();

  for (let i = 0; i < 20; i++) {
    try {
      k("get", "ns", ns);
    } catch {
      console.log("[smoke] part B: OK — checker passed/failed correctly, namespace torn down");
      return;
    }
    await sleep(1000);
  }
  throw new Error(`sn-ex-expose: namespace ${ns} still exists after close (teardown didn't run)`);
}

try {
  await shellSmoke();
  await checkerSmoke();
  console.log("[smoke] all smoke checks passed");
  process.exit(0);
} catch (err) {
  console.error("[smoke] FAILED:", err.message);
  process.exit(1);
}
