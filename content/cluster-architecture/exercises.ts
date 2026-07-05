import type { TerminalExercise } from "@/lib/types/content";
import {
  emptyClusterState,
  makeNode,
  type ClusterState,
  type K8sPod,
} from "@/lib/terminal-engine/cluster-state";

function labPod(
  name: string,
  namespace: string,
  nodeName: string,
  labels: Record<string, string>,
  opts: { daemonSet?: boolean } = {},
): K8sPod {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name,
      namespace,
      labels,
      creationTimestamp: "2026-07-04T10:00:00Z",
      ...(opts.daemonSet
        ? { annotations: { "kubernetes.io/managed-by": "DaemonSet" } }
        : {}),
    },
    spec: {
      containers: [{ name: labels.app ?? "main", image: "nginx:1.27" }],
      nodeName,
    },
    status: {
      phase: "Running",
      podIP: "10.244.1.10",
      containerStatuses: [
        { name: labels.app ?? "main", ready: true, restartCount: 0, state: "Running" },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// 1. etcd backup + restore
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

function rbacInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  state.namespaces.push({
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name: "build", creationTimestamp: "2026-07-01T09:00:00Z" },
    status: { phase: "Active" },
  });
  return state;
}

const rbacCiPipeline: TerminalExercise = {
  id: "ca-ex-rbac-ci",
  domainId: "cluster-architecture",
  title: "Least-privilege RBAC for a CI pipeline",
  scenario: `The \`build\` namespace exists but has no service account for CI yet.

**Task:** In namespace \`build\`:
1. Create a ServiceAccount named \`ci-bot\`.
2. Create a Role named \`deploy-manager\` allowing \`get\`, \`list\`, \`create\`, \`update\` and \`delete\` on \`deployments\`.
3. Bind it to \`ci-bot\` with a RoleBinding named \`ci-bot-deploy\`.`,
  initialState: rbacInitialState(),
  hints: [
    "All three objects have imperative kubectl create forms — no YAML needed.",
    "kubectl create role takes --verb=... --resource=...; the rolebinding subject flag is --serviceaccount=NAMESPACE:NAME (namespace prefix mandatory).",
    `Full solution:
kubectl create serviceaccount ci-bot -n build
kubectl create role deploy-manager --verb=get,list,create,update,delete --resource=deployments -n build
kubectl create rolebinding ci-bot-deploy --role=deploy-manager --serviceaccount=build:ci-bot -n build`,
  ],
  checker: (state) => {
    const sa = state.serviceaccounts.find(
      (s) => s.metadata.name === "ci-bot" && s.metadata.namespace === "build",
    );
    if (!sa) {
      return { passed: false, feedback: "ServiceAccount ci-bot not found in namespace build." };
    }

    const role = state.roles.find(
      (r) => r.metadata.name === "deploy-manager" && r.metadata.namespace === "build",
    );
    if (!role) {
      return { passed: false, feedback: "Role deploy-manager not found in namespace build." };
    }
    const wanted = ["get", "list", "create", "update", "delete"];
    const coversDeployments = role.rules.some(
      (rule) =>
        rule.resources.some((res) => res === "deployments" || res === "*") &&
        wanted.every((v) => rule.verbs.includes(v) || rule.verbs.includes("*")),
    );
    if (!coversDeployments) {
      return {
        passed: false,
        feedback:
          "Role deploy-manager exists but its rules don't cover get,list,create,update,delete on deployments.",
      };
    }

    const binding = state.rolebindings.find(
      (b) => b.metadata.name === "ci-bot-deploy" && b.metadata.namespace === "build",
    );
    if (!binding) {
      return { passed: false, feedback: "RoleBinding ci-bot-deploy not found in namespace build." };
    }
    const refOk = binding.roleRef.kind === "Role" && binding.roleRef.name === "deploy-manager";
    const subjectOk = binding.subjects.some(
      (s) => s.kind === "ServiceAccount" && s.name === "ci-bot" && s.namespace === "build",
    );
    if (!refOk || !subjectOk) {
      return {
        passed: false,
        feedback: !refOk
          ? "ci-bot-deploy doesn't reference Role deploy-manager."
          : "ci-bot-deploy's subject isn't ServiceAccount build:ci-bot — remember the NAMESPACE:NAME form.",
      };
    }
    return {
      passed: true,
      feedback:
        "Least-privilege chain complete: SA → Role → RoleBinding. Verify trick for the real exam: kubectl auth can-i delete deployments --as=system:serviceaccount:build:ci-bot -n build.",
    };
  },
  timeBudgetSeconds: 300,
  points: 80,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 3. Node maintenance: cordon + drain
// ---------------------------------------------------------------------------

function drainInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  state.deployments = [
    {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "web", namespace: "default", labels: { app: "web" } },
      spec: {
        replicas: 2,
        selector: { matchLabels: { app: "web" } },
        template: {
          metadata: { labels: { app: "web" } },
          spec: { containers: [{ name: "web", image: "nginx:1.27" }] },
        },
      },
      status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 },
      rolloutHistory: [{ revision: 1, image: "nginx:1.27" }],
    },
  ];
  state.pods = [
    labPod("web-5d78f9c6b-x2v4q", "default", "node01", { app: "web", "pod-template-hash": "5d78f9c6b" }),
    labPod("web-5d78f9c6b-m8k1p", "default", "node01", { app: "web", "pod-template-hash": "5d78f9c6b" }),
    labPod("kube-proxy-r7t2w", "kube-system", "node01", { "k8s-app": "kube-proxy" }, { daemonSet: true }),
  ];
  return state;
}

const nodeMaintenance: TerminalExercise = {
  id: "ca-ex-node-maintenance",
  domainId: "cluster-architecture",
  title: "Take node01 down for maintenance",
  scenario: `\`node01\` needs a kernel patch.

**Task:** Safely evict all workloads from \`node01\` and mark it unschedulable. DaemonSet pods may remain.`,
  initialState: drainInitialState(),
  hints: [
    "One kubectl command does both the eviction and the cordon.",
    "drain will refuse to touch DaemonSet-managed pods without a flag acknowledging them.",
    "Full solution:\nkubectl drain node01 --ignore-daemonsets",
  ],
  checker: (state) => {
    const node = state.nodes.find((n) => n.metadata.name === "node01");
    if (!node) return { passed: false, feedback: "node01 disappeared — that's not maintenance, that's murder." };
    if (!node.spec.unschedulable) {
      return {
        passed: false,
        feedback: "node01 is still schedulable. Cordoning (or draining, which includes it) is required.",
      };
    }
    const strays = state.pods.filter(
      (p) =>
        p.spec.nodeName === "node01" &&
        p.metadata.annotations?.["kubernetes.io/managed-by"] !== "DaemonSet",
    );
    if (strays.length > 0) {
      return {
        passed: false,
        feedback: `node01 is cordoned but still runs ${strays.length} non-DaemonSet pod(s): ${strays
          .map((p) => p.metadata.name)
          .join(", ")}. Drain it.`,
      };
    }
    return {
      passed: true,
      feedback:
        "node01 cordoned and drained; only DaemonSet pods remain. Don't forget: real tasks usually end with uncordon after the maintenance step.",
    };
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

const exercises: TerminalExercise[] = [etcdBackupRestore, rbacCiPipeline, nodeMaintenance];

export default exercises;
