// Step-5 E2E: run every newly-converted exercise through the real bridge.
// For each: provision session, pre-check must FAIL, apply the solution via
// kubectl (state-graded — path doesn't matter), poll check until PASS, close,
// verify teardown (namespace deleted / node state restored).
import WebSocket from "ws";
import { execFileSync } from "node:child_process";

const REPO = "/home/daniel/project/git-project/cka-trainer";
const KC = `${REPO}/.kubeconfig`;
const WS_URL = "ws://127.0.0.1:3001/term";

function k(...args) {
  return execFileSync("kubectl", ["--kubeconfig", KC, ...args], {
    encoding: "utf8",
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function connect(exerciseId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?exercise=${exerciseId}`, {
      origin: "http://localhost:3000",
    });
    const timer = setTimeout(() => reject(new Error(`${exerciseId}: ready timeout`)), 120000);
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const msg = JSON.parse(data.toString());
      if (msg.type === "ready") {
        clearTimeout(timer);
        resolve({ ws, namespace: msg.namespace });
      } else if (msg.type === "error") {
        clearTimeout(timer);
        reject(new Error(`${exerciseId}: bridge error: ${msg.message}`));
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
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${label}: never passed. Last feedback: ${last?.feedback}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  {
    id: "ca-ex-rbac-ci",
    solve(ns) {
      k("-n", ns, "create", "serviceaccount", "ci-bot");
      k("-n", ns, "create", "role", "deploy-manager",
        "--verb=get,list,create,update,delete", "--resource=deployments");
      k("-n", ns, "create", "rolebinding", "ci-bot-deploy",
        "--role=deploy-manager", `--serviceaccount=${ns}:ci-bot`);
    },
  },
  {
    id: "ca-ex-node-maintenance",
    solve() {
      k("drain", "cka-trainer-worker", "--ignore-daemonsets", "--delete-emptydir-data");
    },
    async after() {
      // teardown must uncordon the worker
      for (let i = 0; i < 20; i++) {
        const out = k("get", "node", "cka-trainer-worker", "-o", "jsonpath={.spec.unschedulable}");
        if (out.trim() !== "true") return;
        await sleep(2000);
      }
      throw new Error("worker still cordoned after teardown");
    },
  },
  {
    id: "sn-ex-expose",
    solve(ns) {
      k("-n", ns, "expose", "deployment", "frontend", "--name=frontend-svc",
        "--port=80", "--target-port=8080");
    },
  },
  {
    id: "sn-ex-nodeport",
    solve(ns) {
      k("-n", ns, "expose", "deployment", "hits", "--name=hits-svc",
        "--type=NodePort", "--port=80", "--target-port=3000");
      k("-n", ns, "patch", "svc", "hits-svc", "--type=json",
        "-p", '[{"op":"replace","path":"/spec/ports/0/nodePort","value":30080}]');
    },
  },
  {
    id: "sn-ex-netpol",
    solve(ns) {
      const yaml = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 5432
`;
      execFileSync("kubectl", ["--kubeconfig", KC, "-n", ns, "apply", "-f", "-"], {
        input: yaml, encoding: "utf8",
      });
    },
  },
  {
    id: "ts-ex-imagepull",
    preAssert(ns) {
      const img = k("-n", ns, "get", "deploy", "web",
        "-o", "jsonpath={.spec.template.spec.containers[0].image}");
      if (img !== "nginx:1.27-alpin") throw new Error(`setup image wrong: ${img}`);
    },
    solve(ns) {
      k("-n", ns, "set", "image", "deployment/web", "web=nginx:1.27-alpine");
    },
  },
  {
    id: "ts-ex-crashloop",
    solve(ns) {
      k("-n", ns, "set", "env", "deployment/api", "DB_HOST=db.default.svc.cluster.local");
    },
  },
  {
    id: "ts-ex-svc-selector",
    solve(ns) {
      k("-n", ns, "patch", "svc", "catalog-svc", "--type=merge",
        "-p", '{"spec":{"selector":{"app":"catalog"}}}');
    },
  },
  {
    id: "ts-ex-taint-pending",
    async preAssert(ns) {
      // taint must land before the deployment → pods born Pending
      const taints = k("get", "node", "cka-trainer-worker", "-o", "jsonpath={.spec.taints[*].key}");
      if (!taints.includes("maintenance")) throw new Error("setup taint missing");
      await sleep(3000);
      const phases = k("-n", ns, "get", "pods", "-o", "jsonpath={.items[*].status.phase}");
      if (!phases.includes("Pending")) throw new Error(`queue pods not Pending: ${phases}`);
    },
    solve() {
      k("taint", "node", "cka-trainer-worker", "maintenance-");
    },
    async after() {
      const taints = k("get", "node", "cka-trainer-worker", "-o", "jsonpath={.spec.taints[*].key}");
      if (taints.includes("maintenance")) throw new Error("maintenance taint left after teardown");
    },
  },
  {
    id: "ws-ex-rollback",
    preAssert(ns) {
      const hist = k("-n", ns, "rollout", "history", "deployment/payments");
      if (!hist.includes("2")) throw new Error(`no revision 2:\n${hist}`);
    },
    solve(ns) {
      k("-n", ns, "rollout", "undo", "deployment/payments");
    },
  },
  {
    id: "ws-ex-scale-autoscale",
    solve(ns) {
      k("-n", ns, "scale", "deployment", "worker", "--replicas=6");
      k("-n", ns, "autoscale", "deployment", "api", "--min=2", "--max=8", "--cpu-percent=70");
    },
  },
  {
    id: "ws-ex-dedicated-node",
    solve(ns) {
      k("taint", "node", "cka-trainer-worker2", "dedicated=cache:NoSchedule", "--overwrite");
      k("label", "node", "cka-trainer-worker2", "role=cache", "--overwrite");
      const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: cache-1
spec:
  nodeSelector:
    role: cache
  tolerations:
  - key: dedicated
    operator: Equal
    value: cache
    effect: NoSchedule
  containers:
  - name: cache-1
    image: redis:7.4-alpine
`;
      execFileSync("kubectl", ["--kubeconfig", KC, "-n", ns, "apply", "-f", "-"], {
        input: yaml, encoding: "utf8",
      });
    },
    async after() {
      const taints = k("get", "node", "cka-trainer-worker2", "-o", "jsonpath={.spec.taints[*].key}");
      if (taints.includes("dedicated")) throw new Error("dedicated taint left after teardown");
      const label = k("get", "node", "cka-trainer-worker2", "-o", "jsonpath={.metadata.labels.role}");
      if (label.trim()) throw new Error(`role label left after teardown: ${label}`);
    },
  },
];

const only = process.argv[2];
let failed = 0;
for (const c of CASES) {
  if (only && c.id !== only) continue;
  const t0 = Date.now();
  try {
    const { ws, namespace } = await connect(c.id);
    if (c.preAssert) await c.preAssert(namespace);
    const pre = await checkOnce(ws);
    if (pre.passed) throw new Error("pre-check passed on the unsolved state!");
    await c.solve(namespace);
    const verdict = await pollPass(ws, c.id);
    ws.close();
    await sleep(4000); // let teardown run
    const nsPhase = (() => {
      try {
        return k("get", "ns", namespace, "-o", "jsonpath={.status.phase}").trim();
      } catch { return "GONE"; }
    })();
    if (nsPhase !== "GONE" && nsPhase !== "Terminating") {
      throw new Error(`namespace ${namespace} still ${nsPhase} after close`);
    }
    if (c.after) await c.after();
    console.log(`PASS  ${c.id}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  "${verdict.feedback.slice(0, 60)}…"`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${c.id}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
