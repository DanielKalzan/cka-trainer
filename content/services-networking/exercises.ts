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

function healthyDeployment(
  name: string,
  namespace: string,
  image: string,
  replicas: number,
  containerPort: number,
): { dep: K8sDeployment; rs: K8sReplicaSet; pods: K8sPod[] } {
  const hash = `${(name.length * 7) % 10}f${(namespace.length * 3) % 10}c8d${name.length % 10}b`;
  const podLabels = { app: name, "pod-template-hash": hash };
  const template = {
    metadata: { labels: { app: name } },
    spec: { containers: [{ name, image, ports: [{ containerPort }] }] },
  };
  const dep: K8sDeployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace, labels: { app: name } },
    spec: { replicas, selector: { matchLabels: { app: name } }, template },
    status: { replicas, readyReplicas: replicas, availableReplicas: replicas },
    rolloutHistory: [{ revision: 1, image }],
  };
  const rs: K8sReplicaSet = {
    apiVersion: "apps/v1",
    kind: "ReplicaSet",
    metadata: {
      name: `${name}-${hash}`,
      namespace,
      labels: podLabels,
      creationTimestamp: "2026-07-04T10:00:00Z",
    },
    spec: {
      replicas,
      selector: { matchLabels: { app: name, "pod-template-hash": hash } },
      template: { metadata: { labels: podLabels }, spec: template.spec },
    },
    status: { replicas, readyReplicas: replicas },
    ownerDeployment: name,
  };
  const suffixes = ["b4nwz", "j9qkt", "r2xdm", "v7pls"];
  const pods: K8sPod[] = Array.from({ length: replicas }, (_, i) => ({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `${name}-${hash}-${suffixes[i % suffixes.length]}`,
      namespace,
      labels: podLabels,
      creationTimestamp: "2026-07-04T10:00:00Z",
    },
    spec: {
      containers: [{ name, image, ports: [{ containerPort }] }],
      nodeName: "node01",
    },
    status: {
      phase: "Running",
      podIP: `10.244.1.${40 + i}`,
      containerStatuses: [{ name, ready: true, restartCount: 0, state: "Running" }],
    },
  }));
  return { dep, rs, pods };
}

function standalonePod(
  name: string,
  namespace: string,
  labels: Record<string, string>,
  image: string,
  containerPort: number,
): K8sPod {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace, labels, creationTimestamp: "2026-07-04T09:00:00Z" },
    spec: {
      containers: [{ name, image, ports: [{ containerPort }] }],
      nodeName: "node01",
    },
    status: {
      phase: "Running",
      podIP: `10.244.1.${(name.length * 13) % 200}`,
      containerStatuses: [{ name, ready: true, restartCount: 0, state: "Running" }],
    },
  };
}

const portNum = (p: number | string | undefined): number | undefined =>
  p === undefined ? undefined : typeof p === "number" ? p : parseInt(p, 10);

// ---------------------------------------------------------------------------
// 1. Expose a deployment
// ---------------------------------------------------------------------------

function exposeInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const { dep, rs, pods } = healthyDeployment("frontend", "default", "ghcr.io/acme/frontend:3.1", 2, 8080);
  state.deployments = [dep];
  state.replicasets = [rs];
  state.pods = pods;
  return state;
}

const exposeDeployment: TerminalExercise = {
  id: "sn-ex-expose",
  domainId: "services-networking",
  title: "Put a Service in front of frontend",
  scenario: `The \`frontend\` Deployment (2 replicas, listening on container port \`8080\`) has no Service yet.

**Task:** Create a ClusterIP Service named \`frontend-svc\` in \`default\` that serves port \`80\` and forwards to the containers on \`8080\`.`,
  initialState: exposeInitialState(),
  hints: [
    "kubectl expose deployment ... — it copies the selector from the Deployment so you can't typo it.",
    "--port is the service's port (80); --target-port is the container's (8080); --name sets the service name.",
    "Full solution:\nkubectl expose deployment frontend --name=frontend-svc --port=80 --target-port=8080",
  ],
  checker: (state) => {
    const svc = state.services.find(
      (s) => s.metadata.name === "frontend-svc" && (s.metadata.namespace ?? "default") === "default",
    );
    if (!svc) return { passed: false, feedback: "No Service named frontend-svc in default yet." };
    if (svc.spec.type && svc.spec.type !== "ClusterIP") {
      return { passed: false, feedback: `frontend-svc is type ${svc.spec.type}; the task asked for ClusterIP.` };
    }
    if (svc.spec.selector?.app !== "frontend") {
      return {
        passed: false,
        feedback:
          "frontend-svc doesn't select the frontend pods (needs selector app=frontend). kubectl expose gets this right automatically.",
      };
    }
    const p = svc.spec.ports[0];
    if (!p || p.port !== 80) {
      return { passed: false, feedback: "The Service must listen on port 80." };
    }
    if (portNum(p.targetPort) !== 8080) {
      return {
        passed: false,
        feedback:
          "targetPort must be 8080 — without --target-port it defaults to the service port (80), where nothing listens.",
      };
    }
    return {
      passed: true,
      feedback:
        "Service up: 80 → 8080, selector matching. Endpoint check (describe svc) would show both pod IPs — always your final verification.",
    };
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. NodePort with a pinned port
// ---------------------------------------------------------------------------

function nodePortInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  const { dep, rs, pods } = healthyDeployment("hits", "default", "ghcr.io/acme/hits:1.2", 2, 3000);
  state.deployments = [dep];
  state.replicasets = [rs];
  state.pods = pods;
  return state;
}

const nodePortService: TerminalExercise = {
  id: "sn-ex-nodeport",
  domainId: "services-networking",
  title: "Expose hits externally on node port 30080",
  scenario: `The \`hits\` Deployment (container port \`3000\`) must be reachable from outside the cluster.

**Task:** Create a NodePort Service named \`hits-svc\` in \`default\`: service port \`80\`, targetPort \`3000\`, and the node port pinned to exactly \`30080\`.`,
  initialState: nodePortInitialState(),
  hints: [
    "Create the service first (kubectl expose --type=NodePort ...), then deal with the exact node port.",
    "No imperative flag pins the nodePort — kubectl edit svc hits-svc and set spec.ports[0].nodePort: 30080.",
    `Full solution:
kubectl expose deployment hits --name=hits-svc --type=NodePort --port=80 --target-port=3000
kubectl edit svc hits-svc
# set spec.ports[0].nodePort: 30080`,
  ],
  checker: (state) => {
    const svc = state.services.find(
      (s) => s.metadata.name === "hits-svc" && (s.metadata.namespace ?? "default") === "default",
    );
    if (!svc) return { passed: false, feedback: "No Service named hits-svc in default yet." };
    if (svc.spec.type !== "NodePort") {
      return { passed: false, feedback: `hits-svc is ${svc.spec.type ?? "ClusterIP"} — it must be NodePort.` };
    }
    if (svc.spec.selector?.app !== "hits") {
      return { passed: false, feedback: "hits-svc doesn't select the hits pods (selector app=hits)." };
    }
    const p = svc.spec.ports[0];
    if (!p || p.port !== 80 || portNum(p.targetPort) !== 3000) {
      return { passed: false, feedback: "Ports must be: port 80 → targetPort 3000." };
    }
    if (p.nodePort !== 30080) {
      return {
        passed: false,
        feedback: `nodePort is ${p.nodePort ?? "unset"} — the task pins it to 30080. Edit the Service and set spec.ports[0].nodePort.`,
      };
    }
    return {
      passed: true,
      feedback:
        "nodeIP:30080 → :80 → :3000. Pinning nodePort via edit is the reliable route; remember the 30000–32767 range constraint.",
    };
  },
  timeBudgetSeconds: 360,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 3. NetworkPolicy: web → db only
// ---------------------------------------------------------------------------

function netpolInitialState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  state.namespaces.push(makeNamespace("prod"));
  state.pods = [
    standalonePod("db-0", "prod", { app: "db" }, "postgres:17", 5432),
    standalonePod("web-1", "prod", { app: "web" }, "ghcr.io/acme/web:5.0", 8080),
    standalonePod("web-2", "prod", { app: "web" }, "ghcr.io/acme/web:5.0", 8080),
    standalonePod("batch-runner", "prod", { app: "batch" }, "ghcr.io/acme/batch:0.9", 9090),
  ];
  return state;
}

interface NetpolPeer {
  podSelector?: { matchLabels?: Record<string, string> };
  namespaceSelector?: { matchLabels?: Record<string, string> };
}
interface NetpolIngressRule {
  from?: NetpolPeer[];
  ports?: { port?: number | string; protocol?: string }[];
}

const netpolWebToDb: TerminalExercise = {
  id: "sn-ex-netpol",
  domainId: "services-networking",
  title: "Lock down the prod database",
  scenario: `Namespace \`prod\` runs a \`db\` pod (\`app=db\`, port \`5432\`), \`web\` pods (\`app=web\`) and a \`batch\` pod. Currently ANY pod can reach the database.

**Task:** Create a NetworkPolicy named \`allow-web-to-db\` in \`prod\` so that only pods labeled \`app=web\` may connect to the \`app=db\` pods, and only on TCP \`5432\`.

(NetworkPolicy has no imperative command — write the YAML and \`kubectl apply -f -\`.)`,
  initialState: netpolInitialState(),
  hints: [
    "Skeleton: spec.podSelector selects WHO is protected (app=db); spec.ingress[].from[].podSelector selects WHO may connect (app=web).",
    "Don't forget policyTypes: [Ingress] and the ports list with protocol TCP, port 5432.",
    `Full solution (kubectl apply -f -, then paste):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
  namespace: prod
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 5432`,
  ],
  checker: (state) => {
    const np = state.networkpolicies.find(
      (n) => n.metadata.name === "allow-web-to-db" && n.metadata.namespace === "prod",
    );
    if (!np) {
      return { passed: false, feedback: "No NetworkPolicy named allow-web-to-db in prod yet. Write the YAML and apply -f -." };
    }
    if (np.spec.podSelector?.matchLabels?.app !== "db") {
      return {
        passed: false,
        feedback:
          "spec.podSelector must select the pods being PROTECTED — the db pods (app=db). The web selector belongs under ingress.from.",
      };
    }
    if (np.spec.policyTypes && !np.spec.policyTypes.includes("Ingress")) {
      return { passed: false, feedback: "policyTypes must include Ingress for this policy to restrict incoming traffic." };
    }
    const rules = (np.spec.ingress ?? []) as NetpolIngressRule[];
    const rule = rules.find((r) =>
      (r.from ?? []).some((f) => f.podSelector?.matchLabels?.app === "web"),
    );
    if (!rule) {
      return {
        passed: false,
        feedback: "No ingress rule allows pods labeled app=web. Check ingress[].from[].podSelector.matchLabels.",
      };
    }
    const portOk = (rule.ports ?? []).some((p) => {
      const n = typeof p.port === "number" ? p.port : parseInt(String(p.port), 10);
      return n === 5432 && (p.protocol === undefined || p.protocol === "TCP");
    });
    if (!portOk) {
      return { passed: false, feedback: "The allowed rule must be limited to TCP port 5432." };
    }
    const tooOpen = (rule.from ?? []).some(
      (f) => !f.podSelector && !f.namespaceSelector,
    );
    if (tooOpen) {
      return { passed: false, feedback: "One of the from entries has no selector at all — that allows everything." };
    }
    return {
      passed: true,
      feedback:
        "db is now default-deny with a single web-only, port-5432 opening — batch is locked out. Textbook least-privilege netpol.",
    };
  },
  timeBudgetSeconds: 480,
  points: 100,
  difficulty: "hard",
};

const exercises: TerminalExercise[] = [exposeDeployment, nodePortService, netpolWebToDb];

export default exercises;
