import type { TerminalExercise } from "@/lib/types/content";

// ---------------------------------------------------------------------------
// 1. Expose a deployment
// ---------------------------------------------------------------------------

const exposeDeployment: TerminalExercise = {
  id: "sn-ex-expose",
  domainId: "services-networking",
  title: "Put a Service in front of frontend",
  scenario: `The \`frontend\` Deployment (2 replicas, container port \`8080\`) has no Service yet.

**Task:** Create a ClusterIP Service named \`frontend-svc\` that serves port \`80\` and forwards to the containers on \`8080\`.

(Work in the terminal's default namespace — no \`-n\` needed.)`,
  hints: [
    "kubectl expose deployment ... — it copies the selector from the Deployment so you can't typo it.",
    "--port is the service's port (80); --target-port is the container's (8080); --name sets the service name.",
    "Full solution:\nkubectl expose deployment frontend --name=frontend-svc --port=80 --target-port=8080",
  ],
  live: {
    manifest: "content/services-networking/manifests/expose.yaml",
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. NodePort with a pinned port
// ---------------------------------------------------------------------------

const nodePortService: TerminalExercise = {
  id: "sn-ex-nodeport",
  domainId: "services-networking",
  title: "Expose hits externally on node port 30080",
  scenario: `The \`hits\` Deployment (container port \`3000\`) must be reachable from outside the cluster.

**Task:** Create a NodePort Service named \`hits-svc\`: service port \`80\`, targetPort \`3000\`, and the node port pinned to exactly \`30080\`.`,
  hints: [
    "Create the service first (kubectl expose --type=NodePort ...), then deal with the exact node port.",
    "No imperative flag pins the nodePort — kubectl edit svc hits-svc and set spec.ports[0].nodePort: 30080.",
    `Full solution:
kubectl expose deployment hits --name=hits-svc --type=NodePort --port=80 --target-port=3000
kubectl edit svc hits-svc
# set spec.ports[0].nodePort: 30080`,
  ],
  live: {
    manifest: "content/services-networking/manifests/nodeport.yaml",
  },
  timeBudgetSeconds: 360,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 3. NetworkPolicy: web → db only
// ---------------------------------------------------------------------------

const netpolWebToDb: TerminalExercise = {
  id: "sn-ex-netpol",
  domainId: "services-networking",
  title: "Lock down the database",
  scenario: `Your namespace runs a \`db\` pod (\`app=db\`, port \`5432\`), \`web\` pods (\`app=web\`) and a \`batch\` pod. Currently ANY pod can reach the database.

**Task:** Create a NetworkPolicy named \`allow-web-to-db\` so that only pods labeled \`app=web\` may connect to the \`app=db\` pods, and only on TCP \`5432\`.

(NetworkPolicy has no imperative command — write the YAML and \`kubectl apply -f -\`.)`,
  hints: [
    "Skeleton: spec.podSelector selects WHO is protected (app=db); spec.ingress[].from[].podSelector selects WHO may connect (app=web).",
    "Don't forget policyTypes: [Ingress] and the ports list with protocol TCP, port 5432.",
    `Full solution (kubectl apply -f -, then paste):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
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
  live: {
    manifest: "content/services-networking/manifests/netpol.yaml",
  },
  timeBudgetSeconds: 480,
  points: 100,
  difficulty: "hard",
};

const exercises: TerminalExercise[] = [exposeDeployment, nodePortService, netpolWebToDb];

export default exercises;
