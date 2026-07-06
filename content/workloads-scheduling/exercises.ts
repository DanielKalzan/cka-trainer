import type { TerminalExercise } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";

// ---------------------------------------------------------------------------
// 1. Bad release: roll back
// ---------------------------------------------------------------------------

const badReleaseRollback: TerminalExercise = {
  id: "ws-ex-rollback",
  domainId: "workloads-scheduling",
  title: "The new payments release is bad — roll it back",
  scenario: `The \`payments\` Deployment was just updated from \`nginx:1.26-alpine\` to \`nginx:1.27-perf\` — a tag that doesn't exist. The rollout is stuck and the new pods can't start.

**Task:** Roll the Deployment back to the previous revision and confirm all 3 replicas are Running.`,
  hints: [
    "kubectl rollout history deployment/payments shows the revisions; the previous one is your target.",
    "kubectl rollout undo goes back one revision by default; verify with rollout status / get pods.",
    "Full solution:\nkubectl rollout undo deployment/payments\nkubectl rollout status deployment/payments",
  ],
  live: {
    manifest: "content/workloads-scheduling/manifests/rollback.yaml",
    setupCommands: [
      ["set", "image", "deployment/payments", "payments=nginx:1.27-perf"],
      ["annotate", "deployment/payments", "kubernetes.io/change-cause=release 1.27-perf"],
    ],
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. Scale + autoscale
// ---------------------------------------------------------------------------

const scaleAndAutoscale: TerminalExercise = {
  id: "ws-ex-scale-autoscale",
  domainId: "workloads-scheduling",
  title: "Scale worker, autoscale api",
  scenario: `Traffic is ramping up.

**Task 1:** Scale the \`worker\` Deployment to \`6\` replicas.

**Task 2:** Autoscale the \`api\` Deployment between \`2\` and \`8\` replicas, targeting \`70%\` CPU utilization.`,
  hints: [
    "Both are single imperative commands — no YAML.",
    "kubectl scale deployment ... --replicas=N and kubectl autoscale deployment ... --min --max --cpu-percent.",
    `Full solution:
kubectl scale deployment worker --replicas=6
kubectl autoscale deployment api --min=2 --max=8 --cpu-percent=70`,
  ],
  live: {
    manifest: "content/workloads-scheduling/manifests/scale-autoscale.yaml",
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 3. Dedicated cache node
// ---------------------------------------------------------------------------

const dedicatedCacheNode: TerminalExercise = {
  id: "ws-ex-dedicated-node",
  domainId: "workloads-scheduling",
  title: `Dedicate ${NODES.worker2} to cache workloads`,
  scenario: `\`${NODES.worker2}\` is being reserved for cache workloads only.

**Task:**
1. Taint \`${NODES.worker2}\` with \`dedicated=cache:NoSchedule\` so ordinary pods stay off it.
2. Label \`${NODES.worker2}\` with \`role=cache\`.
3. Create a pod named \`cache-1\` (image \`redis:7.4-alpine\`) in the terminal's default namespace that both **tolerates** the taint and **targets** the node via a nodeSelector on \`role=cache\`.`,
  hints: [
    "Steps 1–2 are imperative: kubectl taint ... and kubectl label .... Step 3 needs YAML (tolerations have no imperative flag) — kubectl apply -f - and paste.",
    "The toleration must match the taint exactly: key dedicated, operator Equal, value cache, effect NoSchedule. Remember: toleration allows, nodeSelector targets — the task needs both.",
    `Full solution:
kubectl taint node ${NODES.worker2} dedicated=cache:NoSchedule
kubectl label node ${NODES.worker2} role=cache
kubectl apply -f -
apiVersion: v1
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
    image: redis:7.4-alpine`,
  ],
  live: {
    teardownCommands: [
      ["taint", "node", NODES.worker2, "dedicated-"],
      ["label", "node", NODES.worker2, "role-"],
    ],
  },
  timeBudgetSeconds: 480,
  points: 100,
  difficulty: "hard",
};

// ---------------------------------------------------------------------------
// 4. Pod Pending from an unsatisfiable nodeAffinity rule
// ---------------------------------------------------------------------------

const affinityPending: TerminalExercise = {
  id: "ws-ex-affinity-pending",
  domainId: "workloads-scheduling",
  title: "indexer pods stuck Pending",
  scenario: `Both replicas of the \`indexer\` Deployment sit \`Pending\`. \`kubectl describe pod\` shows a \`FailedScheduling\` event naming a node affinity rule that nothing currently satisfies.

**Task:** Get both replicas Running. Don't touch the Deployment's affinity rule — the fix is on the cluster side (label the node the workload actually needs).`,
  hints: [
    "kubectl describe pod <pending pod> — the FailedScheduling event names the exact key/value it's looking for (disktype=ssd).",
    "No node currently carries that label (kubectl get nodes --show-labels). Add it to any node.",
    `Full solution:\nkubectl label node ${NODES.worker} disktype=ssd`,
  ],
  live: {
    manifest: "content/workloads-scheduling/manifests/affinity-pending.yaml",
    teardownCommands: [
      ["label", "node", NODES.controlPlane, "disktype-"],
      ["label", "node", NODES.worker, "disktype-"],
      ["label", "node", NODES.worker2, "disktype-"],
    ],
  },
  timeBudgetSeconds: 300,
  points: 80,
  difficulty: "medium",
};

const exercises: TerminalExercise[] = [
  badReleaseRollback,
  scaleAndAutoscale,
  dedicatedCacheNode,
  affinityPending,
];

export default exercises;
