import type { TerminalExercise } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";

// ---------------------------------------------------------------------------
// 1. etcd backup + restore — node-level scenario: the terminal is a root shell
//    on the real control-plane node, etcdctl/etcdutl provisioned by setup.sh.
// ---------------------------------------------------------------------------

const etcdBackupRestore: TerminalExercise = {
  id: "ca-ex-etcd-backup-restore",
  domainId: "cluster-architecture",
  title: "Back up etcd, then restore it",
  scenario: `Your terminal is a **root shell on \`${NODES.controlPlane}\`** — the real control-plane node. etcd runs there as a static pod (endpoint \`https://127.0.0.1:2379\`, certs under \`/etc/kubernetes/pki/etcd/\`).

**Task 1:** Save a snapshot of etcd to \`/opt/backup/etcd-snapshot.db\`.

**Task 2:** Restore that snapshot into the data directory \`/var/lib/etcd-restored\`.

**Stop there** — do not edit \`/etc/kubernetes/manifests/etcd.yaml\` to point at the new directory (this cluster keeps running on its live data dir). On the real exam that manifest edit is the final step.`,
  hints: [
    "Saving talks to the live etcd API: etcdctl needs the endpoint plus three TLS flags (all three files live in /etc/kubernetes/pki/etcd/). Restoring never touches the API — since etcd 3.6 it lives in the offline tool etcdutl and needs only --data-dir.",
    "Save: etcdctl snapshot save <path> --endpoints=https://127.0.0.1:2379 --cacert=.../ca.crt --cert=.../server.crt --key=.../server.key. Verify with: etcdutl snapshot status <path>.",
    `Full solution:
etcdctl snapshot save /opt/backup/etcd-snapshot.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
etcdutl snapshot restore /opt/backup/etcd-snapshot.db --data-dir=/var/lib/etcd-restored`,
  ],
  live: {
    scenario: "etcd-backup-restore",
  },
  timeBudgetSeconds: 420,
  points: 100,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 2. RBAC for a CI service account
// ---------------------------------------------------------------------------

const rbacCiPipeline: TerminalExercise = {
  id: "ca-ex-rbac-ci",
  domainId: "cluster-architecture",
  title: "Least-privilege RBAC for a CI pipeline",
  scenario: `Your CI pipeline needs a service account with just enough access to manage Deployments.

**Task:** In the terminal's default namespace (no \`-n\` needed):
1. Create a ServiceAccount named \`ci-bot\`.
2. Create a Role named \`deploy-manager\` allowing \`get\`, \`list\`, \`create\`, \`update\` and \`delete\` on \`deployments\`.
3. Bind it to \`ci-bot\` with a RoleBinding named \`ci-bot-deploy\`.`,
  hints: [
    "All three objects have imperative kubectl create forms — no YAML needed.",
    "kubectl create role takes --verb=... --resource=...; the rolebinding subject flag is --serviceaccount=NAMESPACE:NAME (namespace prefix mandatory). Your session namespace is shown above the terminal — or grab it with: kubectl config view --minify -o jsonpath='{..namespace}'",
    `Full solution:
kubectl create serviceaccount ci-bot
kubectl create role deploy-manager --verb=get,list,create,update,delete --resource=deployments
NS=$(kubectl config view --minify -o jsonpath='{..namespace}')
kubectl create rolebinding ci-bot-deploy --role=deploy-manager --serviceaccount=$NS:ci-bot`,
  ],
  live: {},
  timeBudgetSeconds: 300,
  points: 80,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 3. Node maintenance: cordon + drain
// ---------------------------------------------------------------------------

const nodeMaintenance: TerminalExercise = {
  id: "ca-ex-node-maintenance",
  domainId: "cluster-architecture",
  title: `Take ${NODES.worker} down for maintenance`,
  scenario: `\`${NODES.worker}\` needs a kernel patch. A \`web\` Deployment is pinned to it (nodeSelector).

**Task:** Safely evict all workloads from \`${NODES.worker}\` and mark it unschedulable. DaemonSet pods may remain.

(The evicted \`web\` pods will sit \`Pending\` afterwards — they have nowhere else to go. That's the expected mid-maintenance state.)`,
  hints: [
    "One kubectl command does both the eviction and the cordon.",
    "drain will refuse to touch DaemonSet-managed pods without a flag acknowledging them.",
    `Full solution:\nkubectl drain ${NODES.worker} --ignore-daemonsets`,
  ],
  live: {
    manifest: "content/cluster-architecture/manifests/node-maintenance.yaml",
    teardownCommands: [["uncordon", NODES.worker]],
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

const exercises: TerminalExercise[] = [etcdBackupRestore, rbacCiPipeline, nodeMaintenance];

export default exercises;
