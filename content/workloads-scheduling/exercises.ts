import type { TerminalExercise } from "@/lib/types/content";
import {
  emptyClusterState,
  makeNode,
  type ClusterState,
  type K8sDeployment,
  type K8sPod,
  type K8sReplicaSet,
} from "@/lib/terminal-engine/cluster-state";

function deploymentBundle(
  name: string,
  image: string,
  replicas: number,
  hash: string,
  opts: { broken?: { state: string; restarts: number }; requests?: Record<string, string> } = {},
): { dep: K8sDeployment; rs: K8sReplicaSet; pods: K8sPod[] } {
  const podLabels = { app: name, "pod-template-hash": hash };
  const container = {
    name,
    image,
    ...(opts.requests ? { resources: { requests: opts.requests } } : {}),
  };
  const dep: K8sDeployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace: "default", labels: { app: name } },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: { metadata: { labels: { app: name } }, spec: { containers: [container] } },
    },
    status: opts.broken
      ? { replicas, readyReplicas: 0, availableReplicas: 0, unavailableReplicas: replicas }
      : { replicas, readyReplicas: replicas, availableReplicas: replicas },
    rolloutHistory: [{ revision: 1, image }],
  };
  const rs: K8sReplicaSet = {
    apiVersion: "apps/v1",
    kind: "ReplicaSet",
    metadata: {
      name: `${name}-${hash}`,
      namespace: "default",
      labels: podLabels,
      creationTimestamp: "2026-07-04T10:00:00Z",
    },
    spec: {
      replicas,
      selector: { matchLabels: { app: name, "pod-template-hash": hash } },
      template: { metadata: { labels: podLabels }, spec: { containers: [container] } },
    },
    status: { replicas, readyReplicas: opts.broken ? 0 : replicas },
    ownerDeployment: name,
  };
  const suffixes = ["c8wnq", "f3jkt", "m6xzd", "s9plv", "t4hrb", "w7gmc"];
  const pods: K8sPod[] = Array.from({ length: replicas }, (_, i) => ({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `${name}-${hash}-${suffixes[i % suffixes.length]}`,
      namespace: "default",
      labels: podLabels,
      creationTimestamp: "2026-07-05T08:00:00Z",
    },
    spec: { containers: [container], nodeName: "node01" },
    status: opts.broken
      ? {
          phase: "Running",
          podIP: `10.244.1.${60 + i}`,
          containerStatuses: [
            {
              name,
              ready: false,
              restartCount: opts.broken.restarts,
              state: opts.broken.state,
              stateMessage: "back-off restarting failed container",
            },
          ],
        }
      : {
          phase: "Running",
          podIP: `10.244.1.${60 + i}`,
          containerStatuses: [{ name, ready: true, restartCount: 0, state: "Running" }],
        },
  }));
  return { dep, rs, pods };
}

// ---------------------------------------------------------------------------
// 1. Bad release: roll back
// ---------------------------------------------------------------------------

function rollbackInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const { dep, rs, pods } = deploymentBundle("payments", "ghcr.io/acme/payments:2.0", 3, "9d4b7c6f8", {
    broken: { state: "CrashLoopBackOff", restarts: 5 },
  });
  dep.rolloutHistory = [
    { revision: 1, image: "ghcr.io/acme/payments:1.9" },
    { revision: 2, image: "ghcr.io/acme/payments:2.0", changeCause: "release 2.0" },
  ];
  state.deployments = [dep];
  state.replicasets = [rs];
  state.pods = pods;
  state.events = [
    {
      type: "Warning",
      reason: "BackOff",
      message: "Back-off restarting failed container payments in pod payments-9d4b7c6f8-c8wnq",
      involvedObject: "Pod/payments-9d4b7c6f8-c8wnq",
      namespace: "default",
      age: "90s",
      count: 9,
    },
  ];
  return state;
}

const badReleaseRollback: TerminalExercise = {
  id: "ws-ex-rollback",
  domainId: "workloads-scheduling",
  title: "Release 2.0 is bad — roll payments back",
  scenario: `The \`payments\` Deployment was just updated to \`ghcr.io/acme/payments:2.0\` and every pod is crash-looping. The previous version was healthy.

**Task:** Roll the Deployment back to the previous revision and confirm all 3 replicas are Running.`,
  initialState: rollbackInitialState(),
  hints: [
    "kubectl rollout history deployment/payments shows the revisions; the previous one is your target.",
    "kubectl rollout undo goes back one revision by default; verify with rollout status / get pods.",
    "Full solution:\nkubectl rollout undo deployment/payments\nkubectl rollout status deployment/payments",
  ],
  checker: (state) => {
    const dep = state.deployments.find(
      (d) => d.metadata.name === "payments" && (d.metadata.namespace ?? "default") === "default",
    );
    if (!dep) return { passed: false, feedback: "Deployment payments is gone — rollback, not removal." };
    const image = dep.spec.template.spec.containers[0]?.image;
    if (image === "ghcr.io/acme/payments:2.0") {
      return {
        passed: false,
        feedback: "Still on 2.0. kubectl rollout undo deployment/payments reverts to the previous revision.",
      };
    }
    if (image !== "ghcr.io/acme/payments:1.9") {
      return {
        passed: false,
        feedback: `Image is now ${image} — the previous healthy revision ran ghcr.io/acme/payments:1.9. Use rollout undo rather than setting an image by hand.`,
      };
    }
    const running = state.pods.filter(
      (p) =>
        p.metadata.namespace === "default" &&
        p.metadata.labels?.app === "payments" &&
        p.status.phase === "Running" &&
        p.status.containerStatuses?.every((c) => c.ready),
    );
    if (running.length < 3) {
      return { passed: false, feedback: "Rolled back, but not all 3 replicas are Running/ready yet." };
    }
    return {
      passed: true,
      feedback:
        "Back on 1.9 with 3/3 Running — and the rollback itself became a new revision in history. That's expected: undo rolls forward to an old template.",
    };
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. Scale + autoscale
// ---------------------------------------------------------------------------

function scaleInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const worker = deploymentBundle("worker", "ghcr.io/acme/worker:4.2", 2, "5c8d9b7f6");
  const api = deploymentBundle("api", "ghcr.io/acme/api:3.3", 2, "8b6c5d9f7", {
    requests: { cpu: "250m", memory: "128Mi" },
  });
  state.deployments = [worker.dep, api.dep];
  state.replicasets = [worker.rs, api.rs];
  state.pods = [...worker.pods, ...api.pods];
  return state;
}

const scaleAndAutoscale: TerminalExercise = {
  id: "ws-ex-scale-autoscale",
  domainId: "workloads-scheduling",
  title: "Scale worker, autoscale api",
  scenario: `Traffic is ramping up.

**Task 1:** Scale the \`worker\` Deployment to \`6\` replicas.

**Task 2:** Autoscale the \`api\` Deployment between \`2\` and \`8\` replicas, targeting \`70%\` CPU utilization.`,
  initialState: scaleInitialState(),
  hints: [
    "Both are single imperative commands — no YAML.",
    "kubectl scale deployment ... --replicas=N and kubectl autoscale deployment ... --min --max --cpu-percent.",
    `Full solution:
kubectl scale deployment worker --replicas=6
kubectl autoscale deployment api --min=2 --max=8 --cpu-percent=70`,
  ],
  checker: (state) => {
    const worker = state.deployments.find((d) => d.metadata.name === "worker");
    if (!worker) return { passed: false, feedback: "Deployment worker is missing." };
    if (worker.spec.replicas !== 6) {
      return {
        passed: false,
        feedback: `worker has ${worker.spec.replicas} replicas — the task wants 6 (kubectl scale).`,
      };
    }
    const hpa = state.hpas.find((h) => h.refName === "api" && h.namespace === "default");
    if (!hpa) {
      return {
        passed: false,
        feedback: "worker scaled ✓ — but there's no HPA targeting the api Deployment yet (kubectl autoscale).",
      };
    }
    if (hpa.minReplicas !== 2 || hpa.maxReplicas !== 8 || hpa.cpuPercent !== 70) {
      return {
        passed: false,
        feedback: `HPA exists but with min=${hpa.minReplicas}, max=${hpa.maxReplicas}, cpu=${hpa.cpuPercent ?? "unset"}% — the task wants 2 / 8 / 70%.`,
      };
    }
    return {
      passed: true,
      feedback:
        "worker at 6 fixed replicas, api elastic between 2–8 at 70% CPU. Note api's pods carry CPU requests — without them the HPA would sit at <unknown>.",
    };
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 3. Dedicated cache node
// ---------------------------------------------------------------------------

function dedicatedNodeInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [
    makeNode("controlplane", { controlPlane: true }),
    makeNode("node01"),
    makeNode("node02"),
  ];
  return state;
}

const dedicatedCacheNode: TerminalExercise = {
  id: "ws-ex-dedicated-node",
  domainId: "workloads-scheduling",
  title: "Dedicate node02 to cache workloads",
  scenario: `\`node02\` is being reserved for cache workloads only.

**Task:**
1. Taint \`node02\` with \`dedicated=cache:NoSchedule\` so ordinary pods stay off it.
2. Label \`node02\` with \`role=cache\`.
3. Create a pod named \`cache-1\` (image \`redis:7.4\`) in \`default\` that both **tolerates** the taint and **targets** the node via a nodeSelector on \`role=cache\`.`,
  initialState: dedicatedNodeInitialState(),
  hints: [
    "Steps 1–2 are imperative: kubectl taint ... and kubectl label .... Step 3 needs YAML (tolerations have no imperative flag) — kubectl apply -f - and paste.",
    "The toleration must match the taint exactly: key dedicated, operator Equal, value cache, effect NoSchedule. Remember: toleration allows, nodeSelector targets — the task needs both.",
    `Full solution:
kubectl taint node node02 dedicated=cache:NoSchedule
kubectl label node node02 role=cache
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
    image: redis:7.4`,
  ],
  checker: (state) => {
    const node = state.nodes.find((n) => n.metadata.name === "node02");
    if (!node) return { passed: false, feedback: "node02 is missing." };
    const taint = (node.spec.taints ?? []).find(
      (t) => t.key === "dedicated" && t.value === "cache" && t.effect === "NoSchedule",
    );
    if (!taint) {
      return { passed: false, feedback: "node02 lacks the dedicated=cache:NoSchedule taint (kubectl taint node ...)." };
    }
    if (node.metadata.labels?.role !== "cache") {
      return { passed: false, feedback: "Taint ✓ — but node02 still needs the label role=cache." };
    }
    const pod = state.pods.find(
      (p) => p.metadata.name === "cache-1" && (p.metadata.namespace ?? "default") === "default",
    );
    if (!pod) return { passed: false, feedback: "Node prepared ✓ — pod cache-1 doesn't exist yet." };
    if (pod.spec.containers[0]?.image !== "redis:7.4") {
      return { passed: false, feedback: `cache-1 runs ${pod.spec.containers[0]?.image} — the task wants redis:7.4.` };
    }
    if (pod.spec.nodeSelector?.role !== "cache") {
      return {
        passed: false,
        feedback: "cache-1 has no nodeSelector role=cache — tolerating the taint alone doesn't STEER the pod to node02.",
      };
    }
    const tolerated = (pod.spec.tolerations ?? []).some(
      (t) =>
        t.key === "dedicated" &&
        (t.operator === "Exists" || t.value === "cache") &&
        (t.effect === undefined || t.effect === "NoSchedule"),
    );
    if (!tolerated) {
      return {
        passed: false,
        feedback:
          "cache-1 doesn't tolerate dedicated=cache:NoSchedule — without the toleration the nodeSelector points at a node it may not enter.",
      };
    }
    return {
      passed: true,
      feedback:
        "Taint repels everyone else, toleration + nodeSelector pull cache-1 in — the complete dedicated-node pattern. This trio appears on the exam verbatim.",
    };
  },
  timeBudgetSeconds: 480,
  points: 100,
  difficulty: "hard",
};

const exercises: TerminalExercise[] = [badReleaseRollback, scaleAndAutoscale, dedicatedCacheNode];

export default exercises;
