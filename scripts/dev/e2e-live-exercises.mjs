// Step-5 E2E: run every newly-converted exercise through the real bridge.
// For each: provision session, pre-check must FAIL, apply the solution via
// kubectl (state-graded — path doesn't matter), poll check until PASS, close,
// verify teardown (namespace deleted / node state restored).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, checkOnce, pollPass, sleep } from "../lib/ws-client.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KC = `${REPO}/.kubeconfig`;

function k(...args) {
  return execFileSync("kubectl", ["--kubeconfig", KC, ...args], {
    encoding: "utf8",
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const dexec = (cmd) =>
  execFileSync("docker", ["exec", "cka-trainer-control-plane", "bash", "-c", cmd], {
    encoding: "utf8",
  });

const CASES = [
  {
    id: "ca-ex-etcd-backup-restore",
    nodeLevel: true,
    preAssert() {
      // setup.sh must have provisioned the tools and a clean slate
      dexec("command -v etcdctl && command -v etcdutl && test -d /opt/backup");
    },
    solve() {
      dexec(
        "etcdctl snapshot save /opt/backup/etcd-snapshot.db" +
          " --endpoints=https://127.0.0.1:2379" +
          " --cacert=/etc/kubernetes/pki/etcd/ca.crt" +
          " --cert=/etc/kubernetes/pki/etcd/server.crt" +
          " --key=/etc/kubernetes/pki/etcd/server.key",
      );
      dexec("etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir=/var/lib/etcd-restored");
    },
    async after() {
      // teardown.sh must remove the artifacts from the node
      for (let i = 0; i < 10; i++) {
        try {
          dexec("test ! -e /opt/backup && test ! -e /var/lib/etcd-restored");
          return;
        } catch {
          await sleep(1000);
        }
      }
      throw new Error("etcd artifacts left on control-plane after teardown");
    },
  },
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
    id: "ts-ex-oomkilled",
    async preAssert(ns) {
      const limit = k("-n", ns, "get", "deploy", "cache-warmer",
        "-o", "jsonpath={.spec.template.spec.containers[0].resources.limits.memory}");
      if (limit.trim() !== "32Mi") throw new Error(`setup limit wrong: ${limit}`);
    },
    solve(ns) {
      k("-n", ns, "set", "resources", "deployment/cache-warmer", "--limits=memory=512Mi");
    },
  },
  {
    id: "ts-ex-rbac-forbidden",
    async preAssert(ns) {
      // kubectl auth can-i exits 1 (not 0) when the answer is "no" — expected here.
      let out;
      try {
        out = k("auth", "can-i", "update", "deployments",
          `--as=system:serviceaccount:${ns}:deploy-bot`, "-n", ns);
      } catch (e) {
        out = e.stdout ?? "";
      }
      if (!out.includes("no")) throw new Error(`expected 'no' from auth can-i, got: ${out}`);
    },
    solve(ns) {
      k("-n", ns, "patch", "role", "deploy-bot-role", "--type=json",
        "-p", '[{"op":"add","path":"/rules/-","value":{"apiGroups":["apps"],"resources":["deployments"],"verbs":["get","list","update"]}}]');
    },
  },
  {
    id: "ts-ex-coredns-netpol",
    preAssert(ns) {
      const egress = k("-n", ns, "get", "networkpolicy", "deny-egress", "-o", "jsonpath={.spec.egress}");
      if (egress.trim() !== "") throw new Error(`expected empty egress, got: ${egress}`);
    },
    solve(ns) {
      k("-n", ns, "patch", "networkpolicy", "deny-egress", "--type=json",
        "-p", '[{"op":"add","path":"/spec/egress","value":[{"to":[{"namespaceSelector":{"matchLabels":{"kubernetes.io/metadata.name":"kube-system"}}}],"ports":[{"protocol":"UDP","port":53},{"protocol":"TCP","port":53}]}]}]');
    },
  },
  {
    id: "ts-ex-node-cordoned",
    async preAssert() {
      const out = k("get", "node", "cka-trainer-worker2", "-o", "jsonpath={.spec.unschedulable}");
      if (out.trim() !== "true") throw new Error(`setup didn't cordon worker2: ${out}`);
    },
    solve() {
      k("uncordon", "cka-trainer-worker2");
    },
    async after() {
      for (let i = 0; i < 20; i++) {
        const out = k("get", "node", "cka-trainer-worker2", "-o", "jsonpath={.spec.unschedulable}");
        if (out.trim() !== "true") return;
        await sleep(2000);
      }
      throw new Error("worker2 still cordoned after teardown");
    },
  },
  {
    id: "sn-ex-netpol-fix",
    preAssert(ns) {
      const port = k("-n", ns, "get", "networkpolicy", "backend-allow",
        "-o", "jsonpath={.spec.ingress[0].ports[0].port}");
      if (port.trim() !== "80") throw new Error(`expected setup port 80, got: ${port}`);
    },
    solve(ns) {
      k("-n", ns, "patch", "networkpolicy", "backend-allow", "--type=json",
        "-p", '[{"op":"replace","path":"/spec/ingress/0/ports/0/port","value":8080}]');
    },
  },
  {
    id: "ws-ex-affinity-pending",
    async preAssert(ns) {
      await sleep(3000);
      const phases = k("-n", ns, "get", "pods", "-o", "jsonpath={.items[*].status.phase}");
      if (!phases.includes("Pending")) throw new Error(`indexer pods not Pending: ${phases}`);
    },
    solve() {
      k("label", "node", "cka-trainer-worker", "disktype=ssd", "--overwrite");
    },
    async after() {
      const label = k("get", "node", "cka-trainer-worker", "-o", "jsonpath={.metadata.labels.disktype}");
      if (label.trim()) throw new Error(`disktype label left on worker after teardown: ${label}`);
    },
  },
  {
    id: "st-ex-pvc-mismatch",
    preAssert(ns) {
      const sc = k("-n", ns, "get", "pvc", "cache-pvc", "-o", "jsonpath={.spec.storageClassName}");
      if (sc.trim() !== "locall") throw new Error(`expected setup storageClassName locall, got: ${sc}`);
    },
    solve(ns) {
      k("-n", ns, "delete", "pvc", "cache-pvc");
      const yaml = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cache-pvc
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local
  resources:
    requests:
      storage: 500Mi
`;
      execFileSync("kubectl", ["--kubeconfig", KC, "-n", ns, "apply", "-f", "-"], {
        input: yaml, encoding: "utf8",
      });
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
    if (!c.nodeLevel) {
      const nsPhase = (() => {
        try {
          return k("get", "ns", namespace, "-o", "jsonpath={.status.phase}").trim();
        } catch { return "GONE"; }
      })();
      if (nsPhase !== "GONE" && nsPhase !== "Terminating") {
        throw new Error(`namespace ${namespace} still ${nsPhase} after close`);
      }
    }
    if (c.after) await c.after();
    console.log(`PASS  ${c.id}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  "${verdict.feedback.slice(0, 60)}…"`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${c.id}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
