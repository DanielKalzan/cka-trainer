// Simulates mock-exam load: all 8 task sessions open concurrently (like the
// ExamRunner keeping every visited terminal mounted), then a Promise.all batch
// check (= finish()), then mass close (= navigation to results).
import { execFileSync } from "node:child_process";
import { connect as connectSession, checkOnce } from "../lib/ws-client.mjs";

const REPO = "/home/daniel/project/git-project/cka-trainer";
const KC = `${REPO}/.kubeconfig`;
const TASKS = [
  "ts-ex-imagepull",
  "ca-ex-rbac-ci",
  "sn-ex-expose",
  "ws-ex-dedicated-node",
  "ts-ex-taint-pending",
  "ca-ex-etcd-backup-restore",
  "st-ex-pv-pvc-pod",
  "sn-ex-netpol",
];

// Reshape the shared client's { ws, namespace } into this harness's { id, ws, ns }.
async function connect(id) {
  const { ws, namespace } = await connectSession(id);
  return { id, ws, ns: namespace };
}

// Open all 8 sequentially-ish (browser would too) but hold them open together.
const sessions = [];
for (const id of TASKS) sessions.push(await connect(id));
console.log(`8 concurrent sessions up: ${sessions.map((s) => s.ns).join(" ")}`);

// Solve ONE task mid-exam (rbac) to prove grading discriminates.
const rbac = sessions.find((s) => s.id === "ca-ex-rbac-ci");
const k = (...a) => execFileSync("kubectl", ["--kubeconfig", KC, ...a], { encoding: "utf8" });
k("-n", rbac.ns, "create", "serviceaccount", "ci-bot");
k("-n", rbac.ns, "create", "role", "deploy-manager", "--verb=get,list,create,update,delete", "--resource=deployments");
k("-n", rbac.ns, "create", "rolebinding", "ci-bot-deploy", "--role=deploy-manager", `--serviceaccount=${rbac.ns}:ci-bot`);

// finish(): batch-grade everything in parallel.
const t0 = Date.now();
const results = await Promise.all(sessions.map(async (s) => ({ id: s.id, ...(await checkOnce(s.ws)) })));
console.log(`batch grade took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const r of results) console.log(`  ${r.passed ? "PASS" : "fail"}  ${r.id}`);

const passedIds = results.filter((r) => r.passed).map((r) => r.id);
if (passedIds.length !== 1 || passedIds[0] !== "ca-ex-rbac-ci") {
  console.error(`UNEXPECTED: passed set = ${passedIds}`);
  process.exit(1);
}

// Mass close = attempt-wide cleanup.
sessions.forEach((s) => s.ws.close());
await new Promise((r) => setTimeout(r, 8000));
const left = k("get", "ns", "-l", "app.kubernetes.io/managed-by=cka-trainer",
  "-o", "jsonpath={range .items[*]}{.metadata.name}={.status.phase} {end}");
console.log(`namespaces after close: ${left.trim() || "(none)"}`);
const activeLeft = left.split(/\s+/).filter((x) => x && !x.endsWith("=Terminating"));
process.exit(activeLeft.length ? 1 : 0);
