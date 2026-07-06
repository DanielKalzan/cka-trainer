import type { TerminalExercise } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";
import { emptyClusterState, makeNode, type ClusterState } from "@/lib/terminal-engine/cluster-state";

// ---------------------------------------------------------------------------
// 1. etcd backup + restore — still on the sim terminal: it needs a shell on
//    the control-plane node, which arrives with the scenario-scripts step.
// ---------------------------------------------------------------------------

function etcdInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  return state;
}

const etcdBackupRestore: TerminalExercise = {
  id: "ca-ex-etcd-backup-restore",
  domainId: "cluster-architecture",
  title: "Back up etcd, then restore it",
  scenario: `The cluster's etcd runs as a static pod on \`controlplane\` (endpoint \`https://127.0.0.1:2379\`, certs under \`/etc/kubernetes/pki/etcd/\`).

**Task 1:** Save a snapshot of etcd to \`/opt/backup/etcd-snapshot.db\`.

**Task 2:** Restore that snapshot into the data directory \`/var/lib/etcd-restored\`.

(In the real exam you would then edit the etcd static pod manifest — here the simulator stops at the etcdctl commands.)`,
  initialState: etcdInitialState(),
  hints: [
    "etcdctl needs the API endpoint plus three TLS flags. All three files live in the same directory.",
    "Snapshot save: --endpoints=https://127.0.0.1:2379 --cacert=.../ca.crt --cert=.../server.crt --key=.../server.key. Restore needs none of those — only --data-dir.",
    `Full solution:
etcdctl snapshot save /opt/backup/etcd-snapshot.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
etcdctl snapshot restore /opt/backup/etcd-snapshot.db --data-dir=/var/lib/etcd-restored`,
  ],
  checker: (state) => {
    const saved = state.etcd.snapshotsSaved.includes("/opt/backup/etcd-snapshot.db");
    const restored =
      state.etcd.restoredFrom?.snapshotPath === "/opt/backup/etcd-snapshot.db" &&
      state.etcd.restoredFrom?.dataDir === "/var/lib/etcd-restored";
    if (!saved) {
      return {
        passed: false,
        feedback:
          "No snapshot saved to /opt/backup/etcd-snapshot.db yet. Remember the endpoint + three TLS flags.",
      };
    }
    if (!restored) {
      return {
        passed: false,
        feedback:
          "Snapshot saved ✓ — but it hasn't been restored into /var/lib/etcd-restored. Restore takes only --data-dir.",
      };
    }
    return {
      passed: true,
      feedback:
        "Snapshot saved and restored to a fresh data dir. On the real exam, finish by pointing the etcd-data hostPath in /etc/kubernetes/manifests/etcd.yaml at the new directory.",
    };
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
