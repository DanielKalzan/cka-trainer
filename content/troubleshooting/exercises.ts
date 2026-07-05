import type { TerminalExercise } from "@/lib/types/content";
import {
  emptyClusterState,
  makeNamespace,
  makeNode,
  type ClusterState,
  type K8sDeployment,
  type K8sPod,
  type K8sReplicaSet,
} from "@/lib/terminal-engine/cluster-state";

function labDeployment(
  name: string,
  namespace: string,
  image: string,
  replicas: number,
  extra: Partial<K8sDeployment["spec"]["template"]["spec"]> = {},
): K8sDeployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace, labels: { app: name } },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name, image }], ...extra },
      },
    },
    status: { replicas, readyReplicas: 0, availableReplicas: 0, unavailableReplicas: replicas },
    rolloutHistory: [{ revision: 1, image }],
  };
}

function labReplicaSet(dep: K8sDeployment, hash: string): K8sReplicaSet {
  const ns = dep.metadata.namespace ?? "default";
  return {
    apiVersion: "apps/v1",
    kind: "ReplicaSet",
    metadata: {
      name: `${dep.metadata.name}-${hash}`,
      namespace: ns,
      labels: { ...dep.spec.template.metadata.labels, "pod-template-hash": hash },
      creationTimestamp: "2026-07-04T10:00:00Z",
    },
    spec: {
      replicas: dep.spec.replicas,
      selector: { matchLabels: { ...dep.spec.selector.matchLabels, "pod-template-hash": hash } },
      template: dep.spec.template,
    },
    status: { replicas: dep.spec.replicas, readyReplicas: 0 },
    ownerDeployment: dep.metadata.name,
  };
}

function brokenPod(
  name: string,
  namespace: string,
  labels: Record<string, string>,
  image: string,
  fault: {
    state: string;
    phase?: K8sPod["status"]["phase"];
    stateMessage?: string;
    restartCount?: number;
    nodeName?: string;
    mockLogs?: Record<string, string>;
    spec?: Partial<K8sPod["spec"]>;
  },
): K8sPod {
  const containerName = labels.app ?? "main";
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace, labels, creationTimestamp: "2026-07-05T09:00:00Z" },
    spec: {
      containers: [{ name: containerName, image }],
      ...(fault.nodeName ? { nodeName: fault.nodeName } : {}),
      ...fault.spec,
    },
    status: {
      phase: fault.phase ?? "Pending",
      ...(fault.nodeName ? { podIP: "10.244.1.23" } : {}),
      containerStatuses: [
        {
          name: containerName,
          ready: false,
          restartCount: fault.restartCount ?? 0,
          state: fault.state,
          stateMessage: fault.stateMessage,
        },
      ],
    },
    ...(fault.mockLogs ? { mockLogs: fault.mockLogs } : {}),
  };
}

// ---------------------------------------------------------------------------
// 1. ImagePullBackOff
// ---------------------------------------------------------------------------

function imagePullInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const dep = labDeployment("web", "default", "nginx:1.27-alpin", 2);
  state.deployments = [dep];
  state.replicasets = [labReplicaSet(dep, "6b9c7d54f")];
  const podLabels = { app: "web", "pod-template-hash": "6b9c7d54f" };
  state.pods = [
    brokenPod("web-6b9c7d54f-q2xkm", "default", podLabels, "nginx:1.27-alpin", {
      state: "ImagePullBackOff",
      nodeName: "node01",
      stateMessage: 'Back-off pulling image "nginx:1.27-alpin"',
    }),
    brokenPod("web-6b9c7d54f-t8vrp", "default", podLabels, "nginx:1.27-alpin", {
      state: "ImagePullBackOff",
      nodeName: "node01",
      stateMessage: 'Back-off pulling image "nginx:1.27-alpin"',
    }),
  ];
  state.events = [
    {
      type: "Warning",
      reason: "Failed",
      message:
        'Failed to pull image "nginx:1.27-alpin": rpc error: manifest for nginx:1.27-alpin not found',
      involvedObject: "Pod/web-6b9c7d54f-q2xkm",
      namespace: "default",
      age: "2m",
      count: 5,
    },
  ];
  return state;
}

const imagePullBackOff: TerminalExercise = {
  id: "ts-ex-imagepull",
  domainId: "troubleshooting",
  title: "web is down: ImagePullBackOff",
  scenario: `Users report the \`web\` app in namespace \`default\` is down. Its pods aren't starting.

**Task:** Find why and fix the Deployment so all replicas run. The intended image tag is \`nginx:1.27-alpine\`.`,
  initialState: imagePullInitialState(),
  hints: [
    "kubectl get pods, then kubectl describe pod <name> — read the Events at the bottom for the exact image string.",
    "The tag has a typo. Fix it on the DEPLOYMENT (not the pods) — kubectl set image is fastest.",
    "Full solution:\nkubectl set image deployment/web web=nginx:1.27-alpine",
  ],
  checker: (state) => {
    const dep = state.deployments.find(
      (d) => d.metadata.name === "web" && (d.metadata.namespace ?? "default") === "default",
    );
    if (!dep) return { passed: false, feedback: "Deployment web is gone. Fix the image, don't delete the workload." };
    const image = dep.spec.template.spec.containers[0]?.image;
    if (image === "nginx:1.27-alpin") {
      return {
        passed: false,
        feedback:
          "The Deployment still points at nginx:1.27-alpin (the broken tag). describe a pod and read its events.",
      };
    }
    if (image !== "nginx:1.27-alpine") {
      return {
        passed: false,
        feedback: `Image changed to ${image}, but the task asked for nginx:1.27-alpine exactly.`,
      };
    }
    const pods = state.pods.filter(
      (p) => p.metadata.namespace === "default" && p.metadata.labels?.app === "web",
    );
    const running = pods.filter((p) => p.status.phase === "Running");
    if (pods.length < 2 || running.length < 2) {
      return {
        passed: false,
        feedback:
          "Image fixed on the Deployment, but not all web pods are Running yet — did you change the pod spec somewhere else instead of the Deployment template?",
      };
    }
    return {
      passed: true,
      feedback:
        "Both replicas Running on the corrected tag. Fixing the Deployment (not the pods) is the pattern — controllers always win.",
    };
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. CrashLoopBackOff — missing env var
// ---------------------------------------------------------------------------

function crashLoopInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const dep = labDeployment("api", "default", "ghcr.io/acme/api:2.4", 1);
  state.deployments = [dep];
  state.replicasets = [labReplicaSet(dep, "5f6d8b9c7")];
  state.pods = [
    brokenPod(
      "api-5f6d8b9c7-w4jns",
      "default",
      { app: "api", "pod-template-hash": "5f6d8b9c7" },
      "ghcr.io/acme/api:2.4",
      {
        state: "CrashLoopBackOff",
        phase: "Running",
        nodeName: "node01",
        restartCount: 7,
        stateMessage: "back-off 5m0s restarting failed container",
        mockLogs: {
          "": "starting acme-api 2.4\nFATAL: required environment variable DB_HOST is not set\n",
        },
      },
    ),
  ];
  state.events = [
    {
      type: "Warning",
      reason: "BackOff",
      message: "Back-off restarting failed container api in pod api-5f6d8b9c7-w4jns",
      involvedObject: "Pod/api-5f6d8b9c7-w4jns",
      namespace: "default",
      age: "45s",
      count: 12,
    },
  ];
  return state;
}

const crashLoop: TerminalExercise = {
  id: "ts-ex-crashloop",
  domainId: "troubleshooting",
  title: "api crash-loops on startup",
  scenario: `The \`api\` Deployment in \`default\` restarts endlessly (CrashLoopBackOff).

**Task:** Find out why from the container's own output and fix the Deployment so the pod runs. The database it needs is reachable at \`db.default.svc.cluster.local\`.`,
  initialState: crashLoopInitialState(),
  hints: [
    "kubectl logs <pod> — the app prints exactly what's missing before it dies.",
    "The container needs an environment variable. Add it to the Deployment's pod template: kubectl edit deployment api → spec.template.spec.containers[0].env.",
    `Full solution:
kubectl edit deployment api
# add under the container:
#   env:
#   - name: DB_HOST
#     value: db.default.svc.cluster.local`,
  ],
  checker: (state) => {
    const dep = state.deployments.find(
      (d) => d.metadata.name === "api" && (d.metadata.namespace ?? "default") === "default",
    );
    if (!dep) return { passed: false, feedback: "Deployment api is gone — the task was to fix it, not remove it." };
    const env = dep.spec.template.spec.containers[0]?.env ?? [];
    const dbHost = env.find((e) => e.name === "DB_HOST");
    if (!dbHost || !dbHost.value) {
      return {
        passed: false,
        feedback:
          "The Deployment's container still has no DB_HOST env var. kubectl logs on the pod says exactly what it wants.",
      };
    }
    const pods = state.pods.filter(
      (p) => p.metadata.namespace === "default" && p.metadata.labels?.app === "api",
    );
    const healthy = pods.filter((p) =>
      p.status.containerStatuses?.every((c) => c.ready && c.state === "Running"),
    );
    if (healthy.length < 1) {
      return {
        passed: false,
        feedback:
          "DB_HOST is set but the pod isn't healthy — make sure you edited the DEPLOYMENT template so the controller rolls out a fresh pod.",
      };
    }
    return {
      passed: true,
      feedback:
        "Crash loop broken: logs → missing env var → edit the Deployment. That read-the-logs-first reflex is worth a lot of exam points.",
    };
  },
  timeBudgetSeconds: 360,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 3. Service selector mismatch
// ---------------------------------------------------------------------------

function svcSelectorInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  state.namespaces.push(makeNamespace("shop"));
  const dep = labDeployment("catalog", "shop", "ghcr.io/acme/catalog:1.9", 2);
  dep.spec.template.spec.containers[0].ports = [{ containerPort: 8080 }];
  dep.status = { replicas: 2, readyReplicas: 2, availableReplicas: 2 };
  state.deployments = [dep];
  state.replicasets = [labReplicaSet(dep, "78c4d6b9f")];
  state.replicasets[0].status = { replicas: 2, readyReplicas: 2 };
  const podLabels = { app: "catalog", "pod-template-hash": "78c4d6b9f" };
  state.pods = ["k7mzq", "p3wtd"].map((suffix, i) => ({
    apiVersion: "v1" as const,
    kind: "Pod" as const,
    metadata: {
      name: `catalog-78c4d6b9f-${suffix}`,
      namespace: "shop",
      labels: podLabels,
      creationTimestamp: "2026-07-04T08:00:00Z",
    },
    spec: {
      containers: [
        { name: "catalog", image: "ghcr.io/acme/catalog:1.9", ports: [{ containerPort: 8080 }] },
      ],
      nodeName: "node01",
    },
    status: {
      phase: "Running" as const,
      podIP: `10.244.1.${30 + i}`,
      containerStatuses: [{ name: "catalog", ready: true, restartCount: 0, state: "Running" }],
    },
  }));
  state.services = [
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "catalog-svc", namespace: "shop", creationTimestamp: "2026-07-04T08:05:00Z" },
      spec: {
        type: "ClusterIP",
        selector: { app: "catalogue" },
        ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }],
        clusterIP: "10.106.44.7",
      },
    },
  ];
  return state;
}

const svcSelector: TerminalExercise = {
  id: "ts-ex-svc-selector",
  domainId: "troubleshooting",
  title: "Service returns connection refused",
  scenario: `In namespace \`shop\`, the \`catalog\` pods are Running and healthy, but requests to service \`catalog-svc\` fail — it has no endpoints.

**Task:** Find the mismatch and fix the Service (the pods are considered correct).`,
  initialState: svcSelectorInitialState(),
  hints: [
    "Compare kubectl describe svc catalog-svc -n shop (Selector) with kubectl get pods -n shop --show-labels.",
    "The Service selects app=catalogue; the pods are labeled app=catalog. The task says the pods are right — edit the Service.",
    "Full solution:\nkubectl edit svc catalog-svc -n shop\n# change spec.selector.app from 'catalogue' to 'catalog'",
  ],
  checker: (state) => {
    const svc = state.services.find(
      (s) => s.metadata.name === "catalog-svc" && s.metadata.namespace === "shop",
    );
    if (!svc) return { passed: false, feedback: "Service catalog-svc is gone from namespace shop." };
    if (svc.spec.selector?.app !== "catalog") {
      return {
        passed: false,
        feedback:
          "catalog-svc still doesn't select the running pods. Its selector must match the pods' labels exactly (app=catalog).",
      };
    }
    const port = svc.spec.ports[0];
    if (!port || port.port !== 80 || port.targetPort !== 8080) {
      return {
        passed: false,
        feedback:
          "Selector is fixed, but keep the ports as they were: port 80 → targetPort 8080 (the container listens on 8080).",
      };
    }
    const labelsChanged = state.pods.some(
      (p) => p.metadata.namespace === "shop" && p.metadata.labels?.app === "catalogue",
    );
    if (labelsChanged) {
      return {
        passed: false,
        feedback: "The task said the pods are correct — fix the Service selector, not the pod labels.",
      };
    }
    return {
      passed: true,
      feedback:
        "Selector matches, endpoints populate, traffic flows. Selector↔label mismatch is the #1 cause of 'service is down' tasks.",
    };
  },
  timeBudgetSeconds: 300,
  points: 70,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 4. Pods Pending behind a leftover taint
// ---------------------------------------------------------------------------

function taintPendingInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [
    makeNode("controlplane", { controlPlane: true }),
    makeNode("node01", {
      taints: [{ key: "maintenance", value: "true", effect: "NoSchedule" }],
    }),
  ];
  const dep = labDeployment("queue", "default", "redis:7.4", 2);
  state.deployments = [dep];
  state.replicasets = [labReplicaSet(dep, "7c9b6d5f4")];
  const podLabels = { app: "queue", "pod-template-hash": "7c9b6d5f4" };
  state.pods = [
    brokenPod("queue-7c9b6d5f4-hx2vm", "default", podLabels, "redis:7.4", {
      state: "Pending",
    }),
    brokenPod("queue-7c9b6d5f4-zq8rt", "default", podLabels, "redis:7.4", {
      state: "Pending",
    }),
  ];
  state.pods.forEach((p) => {
    p.status.reason = "Unschedulable";
    p.status.message =
      "0/2 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 1 node(s) had untolerated taint {maintenance: true}.";
  });
  state.events = [
    {
      type: "Warning",
      reason: "FailedScheduling",
      message:
        "0/2 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 1 node(s) had untolerated taint {maintenance: true}.",
      involvedObject: "Pod/queue-7c9b6d5f4-hx2vm",
      namespace: "default",
      age: "3m",
      count: 8,
    },
  ];
  return state;
}

const taintPending: TerminalExercise = {
  id: "ts-ex-taint-pending",
  domainId: "troubleshooting",
  title: "queue pods stuck Pending",
  scenario: `Last week's maintenance on \`node01\` is finished, but the \`queue\` Deployment's pods sit in \`Pending\`.

**Task:** Find what still blocks scheduling, remove it, and get both \`queue\` replicas Running. Do not modify the Deployment.`,
  initialState: taintPendingInitialState(),
  hints: [
    "kubectl describe pod <pending pod> — the FailedScheduling event names every taint in the way.",
    "Remove the leftover taint: kubectl taint node node01 maintenance- (trailing dash = remove). Then force a reschedule by deleting the Pending pods — their ReplicaSet replaces them instantly.",
    `Full solution:
kubectl taint node node01 maintenance-
kubectl delete pod -l app=queue`,
  ],
  checker: (state) => {
    const node = state.nodes.find((n) => n.metadata.name === "node01");
    if (!node) return { passed: false, feedback: "node01 is missing — removing the node was not the task." };
    const stillTainted = (node.spec.taints ?? []).some((t) => t.key === "maintenance");
    if (stillTainted) {
      return {
        passed: false,
        feedback:
          "node01 still carries the maintenance taint. The FailedScheduling event in describe pod names it exactly.",
      };
    }
    const pods = state.pods.filter(
      (p) => p.metadata.namespace === "default" && p.metadata.labels?.app === "queue",
    );
    const running = pods.filter((p) => p.status.phase === "Running");
    if (running.length < 2) {
      return {
        passed: false,
        feedback:
          "Taint removed, but the old Pending pods won't reschedule themselves here — delete them and let the ReplicaSet create fresh ones.",
      };
    }
    const dep = state.deployments.find((d) => d.metadata.name === "queue");
    if (!dep || dep.spec.template.spec.tolerations?.length) {
      return {
        passed: false,
        feedback: "Both pods run, but the task said not to modify the Deployment (no tolerations workaround).",
      };
    }
    return {
      passed: true,
      feedback:
        "Taint gone, replicas rescheduled and Running. taint <node> <key>- to remove is worth having in muscle memory.",
    };
  },
  timeBudgetSeconds: 360,
  points: 90,
  difficulty: "medium",
};

const exercises: TerminalExercise[] = [imagePullBackOff, crashLoop, svcSelector, taintPending];

export default exercises;
