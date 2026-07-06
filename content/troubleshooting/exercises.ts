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

// ---------------------------------------------------------------------------
// 5. OOMKilled — memory limit too low for the app's real footprint
// ---------------------------------------------------------------------------

const oomKilled: TerminalExercise = {
  id: "ts-ex-oomkilled",
  domainId: "troubleshooting",
  title: "cache-warmer keeps getting OOMKilled",
  scenario: `The \`cache-warmer\` Deployment restarts endlessly. \`kubectl describe pod\` shows \`Last State: Terminated, Reason: OOMKilled, Exit Code: 137\`.

**Task:** Give it enough memory headroom to stay Running. It briefly spikes well above its ~128Mi steady-state size while warming up — size the limit for that spike, not just the steady state.`,
  hints: [
    "kubectl describe pod <name> — check the Last State block and the container's current resources.limits.memory.",
    "137 = SIGKILL from the kernel OOM killer: the limit is below what the app actually needs at its peak, not just once it settles. Raise resources.limits.memory generously — try 512Mi.",
    "Full solution:\nkubectl set resources deployment/cache-warmer --limits=memory=512Mi",
  ],
  live: {
    manifest: "content/troubleshooting/manifests/oomkilled.yaml",
  },
  timeBudgetSeconds: 300,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 6. RBAC-denied kubectl action — Role too narrow for what the SA needs
// ---------------------------------------------------------------------------

const rbacForbidden: TerminalExercise = {
  id: "ts-ex-rbac-forbidden",
  domainId: "troubleshooting",
  title: "CI's ServiceAccount gets Forbidden",
  scenario: `The CI pipeline's ServiceAccount \`deploy-bot\` gets \`Forbidden\` when it tries to update Deployments as part of a release.

**Task:** Find out why and fix it so \`deploy-bot\` can update Deployments. Its RoleBinding is already correct — don't touch it.`,
  hints: [
    "kubectl auth can-i update deployments --as=system:serviceaccount:<ns>:deploy-bot — reproduce the Forbidden before changing anything. Your session namespace: kubectl config view --minify -o jsonpath='{..namespace}'",
    "The RoleBinding is fine. Edit the Role's rules to add apps/deployments with the verbs it needs (get, list, update at least).",
    `Full solution:
kubectl edit role deploy-bot-role
# add a rule:
#   - apiGroups: ["apps"]
#     resources: ["deployments"]
#     verbs: ["get", "list", "update"]`,
  ],
  live: {
    manifest: "content/troubleshooting/manifests/rbac-forbidden.yaml",
  },
  timeBudgetSeconds: 300,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 7. DNS resolution failure — a NetworkPolicy over-blocking required traffic
// ---------------------------------------------------------------------------

const coreDnsNetpol: TerminalExercise = {
  id: "ts-ex-coredns-netpol",
  domainId: "troubleshooting",
  title: "Nothing in this namespace can resolve DNS",
  scenario: `The \`deny-egress\` NetworkPolicy locks the \`client\` pod down completely — no egress at all, including DNS. \`nslookup kubernetes.default\` from inside \`client\` hangs and times out.

**Task:** Add an egress rule to \`deny-egress\` allowing DNS to kube-system (UDP + TCP port 53) — keep everything else blocked.`,
  hints: [
    "Exec into client and try nslookup kubernetes.default first — confirm it hangs. kubectl describe netpol deny-egress shows egress: [] — nothing is allowed out, not even DNS.",
    "Every namespace carries the built-in label kubernetes.io/metadata.name=<ns> (since 1.21) — use a namespaceSelector matching kube-system, plus ports 53/UDP and 53/TCP (CoreDNS listens on both).",
    `Full solution:
kubectl edit networkpolicy deny-egress
# add under spec.egress:
# - to:
#   - namespaceSelector:
#       matchLabels:
#         kubernetes.io/metadata.name: kube-system
#   ports:
#   - protocol: UDP
#     port: 53
#   - protocol: TCP
#     port: 53`,
  ],
  live: {
    manifest: "content/troubleshooting/manifests/coredns-netpol.yaml",
  },
  timeBudgetSeconds: 420,
  points: 100,
  difficulty: "hard",
};

// ---------------------------------------------------------------------------
// 8. Leftover cordon blocking scheduling
// ---------------------------------------------------------------------------

const nodeCordoned: TerminalExercise = {
  id: "ts-ex-node-cordoned",
  domainId: "troubleshooting",
  title: `Nothing new schedules onto ${NODES.worker2}`,
  scenario: `Nobody's noticed anything land on \`${NODES.worker2}\` in days. \`kubectl get nodes\` shows it \`SchedulingDisabled\` — cordoned during an investigation that finished without cleanup.

**Task:** Confirm nothing else is wrong with the node, then make it schedulable again.`,
  hints: [
    "kubectl get nodes — the STATUS column names it directly.",
    "kubectl describe node <name> for anything else abnormal (there isn't); cordon only sets unschedulable, it doesn't taint or evict anything.",
    `Full solution:\nkubectl uncordon ${NODES.worker2}`,
  ],
  live: {
    setupCommands: [["cordon", NODES.worker2]],
    teardownCommands: [["uncordon", NODES.worker2]],
  },
  timeBudgetSeconds: 180,
  points: 50,
  difficulty: "easy",
};

const exercises: TerminalExercise[] = [
  imagePullBackOff,
  crashLoop,
  svcSelector,
  taintPending,
  oomKilled,
  rbacForbidden,
  coreDnsNetpol,
  nodeCordoned,
];

export default exercises;
