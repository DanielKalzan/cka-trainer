import type { TerminalExercise } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";

// ---------------------------------------------------------------------------
// 1. ImagePullBackOff
// ---------------------------------------------------------------------------

const imagePullBackOff: TerminalExercise = {
  id: "ts-ex-imagepull",
  domainId: "troubleshooting",
  title: "web is down: ImagePullBackOff",
  scenario: `Users report the \`web\` app is down. Its pods aren't starting.

**Task:** Find why and fix the Deployment so all replicas run. The intended image tag is \`nginx:1.27-alpine\`.

(Work in the terminal's default namespace — no \`-n\` needed.)`,
  hints: [
    "kubectl get pods, then kubectl describe pod <name> — read the Events at the bottom for the exact image string.",
    "The tag has a typo. Fix it on the DEPLOYMENT (not the pods) — kubectl set image is fastest.",
    "Full solution:\nkubectl set image deployment/web web=nginx:1.27-alpine",
  ],
  live: {
    manifest: "content/troubleshooting/manifests/imagepull.yaml",
  },
  timeBudgetSeconds: 240,
  points: 60,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// 2. CrashLoopBackOff — missing env var
// ---------------------------------------------------------------------------

const crashLoop: TerminalExercise = {
  id: "ts-ex-crashloop",
  domainId: "troubleshooting",
  title: "api crash-loops on startup",
  scenario: `The \`api\` Deployment restarts endlessly (CrashLoopBackOff).

**Task:** Find out why from the container's own output and fix the Deployment so the pod runs. The database it needs is reachable at \`db.default.svc.cluster.local\`.`,
  hints: [
    "kubectl logs <pod> — the app prints exactly what's missing before it dies.",
    "The container needs an environment variable. Add it to the Deployment's pod template: kubectl edit deployment api → spec.template.spec.containers[0].env (or kubectl set env).",
    `Full solution:
kubectl set env deployment/api DB_HOST=db.default.svc.cluster.local
# or kubectl edit deployment api and add under the container:
#   env:
#   - name: DB_HOST
#     value: db.default.svc.cluster.local`,
  ],
  live: {
    manifest: "content/troubleshooting/manifests/crashloop.yaml",
  },
  timeBudgetSeconds: 360,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 3. Service selector mismatch
// ---------------------------------------------------------------------------

const svcSelector: TerminalExercise = {
  id: "ts-ex-svc-selector",
  domainId: "troubleshooting",
  title: "Service returns connection refused",
  scenario: `The \`catalog\` pods are Running and healthy, but requests to service \`catalog-svc\` fail — it has no endpoints.

**Task:** Find the mismatch and fix the Service (the pods are considered correct).`,
  hints: [
    "Compare kubectl describe svc catalog-svc (Selector) with kubectl get pods --show-labels.",
    "The Service selects app=catalogue; the pods are labeled app=catalog. The task says the pods are right — edit the Service.",
    "Full solution:\nkubectl edit svc catalog-svc\n# change spec.selector.app from 'catalogue' to 'catalog'",
  ],
  live: {
    manifest: "content/troubleshooting/manifests/svc-selector.yaml",
  },
  timeBudgetSeconds: 300,
  points: 70,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 4. Pods Pending behind a leftover taint
// ---------------------------------------------------------------------------

const taintPending: TerminalExercise = {
  id: "ts-ex-taint-pending",
  domainId: "troubleshooting",
  title: "queue pods stuck Pending",
  scenario: `Last week's maintenance on \`${NODES.worker}\` is finished, but the \`queue\` Deployment's pods sit in \`Pending\`. (queue is pinned to that node by design — its nodeSelector is correct.)

**Task:** Find what still blocks scheduling, remove it, and get both \`queue\` replicas Running. Do not modify the Deployment.`,
  hints: [
    "kubectl describe pod <pending pod> — the FailedScheduling event names every taint in the way.",
    `Remove the leftover taint: kubectl taint node ${NODES.worker} maintenance- (trailing dash = remove). The scheduler retries Pending pods on its own — no need to delete them.`,
    `Full solution:\nkubectl taint node ${NODES.worker} maintenance-`,
  ],
  live: {
    setupCommands: [
      ["taint", "node", NODES.worker, "maintenance=true:NoSchedule", "--overwrite"],
      ["apply", "-f", "content/troubleshooting/manifests/taint-pending.yaml"],
    ],
    teardownCommands: [["taint", "node", NODES.worker, "maintenance-"]],
  },
  timeBudgetSeconds: 360,
  points: 90,
  difficulty: "medium",
};

const exercises: TerminalExercise[] = [imagePullBackOff, crashLoop, svcSelector, taintPending];

export default exercises;
