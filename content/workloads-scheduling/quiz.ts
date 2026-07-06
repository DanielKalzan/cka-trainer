import type { QuizQuestion } from "@/lib/types/content";

const quiz: QuizQuestion[] = [
  {
    id: "ws-q-set-image",
    domainId: "workloads-scheduling",
    type: "command-fill",
    prompt:
      "Deployment `web` runs a container named `nginx`. One command to roll it to image `nginx:1.28`:",
    correctAnswer: "kubectl set image deployment/web nginx=nginx:1.28",
    acceptableAnswers: [
      "kubectl set image deployment/web nginx=nginx:1.28",
      "kubectl set image deploy/web nginx=nginx:1.28",
      "kubectl set image deployment web nginx=nginx:1.28",
      "k set image deployment/web nginx=nginx:1.28",
      "k set image deploy/web nginx=nginx:1.28",
    ],
    explanation:
      "set image takes CONTAINER=IMAGE — the left side is the container's name inside the pod template, not the deployment's. This triggers a normal rolling update with a new revision.",
  },
  {
    id: "ws-q-surge-unavail",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "A task demands a rolling update with 'no reduction in serving capacity at any moment'. Which strategy settings?",
    options: [
      "maxSurge: 1, maxUnavailable: 0",
      "maxSurge: 0, maxUnavailable: 1",
      "strategy type Recreate",
      "maxSurge: 0, maxUnavailable: 0",
    ],
    correctAnswer: "maxSurge: 1, maxUnavailable: 0",
    explanation:
      "maxUnavailable: 0 forbids dropping below desired replicas, so the roll must surge (extra pod first, then retire an old one). 0/0 is invalid — the rollout could never proceed; Recreate drops everything.",
  },
  {
    id: "ws-q-taint-remove",
    domainId: "workloads-scheduling",
    type: "command-fill",
    prompt: "Remove the taint with key `dedicated` from node01 (one command):",
    correctAnswer: "kubectl taint node node01 dedicated-",
    acceptableAnswers: [
      "kubectl taint node node01 dedicated-",
      "kubectl taint nodes node01 dedicated-",
      "k taint node node01 dedicated-",
      "k taint nodes node01 dedicated-",
      "kubectl taint node node01 dedicated:NoSchedule-",
      "kubectl taint nodes node01 dedicated:NoSchedule-",
    ],
    explanation:
      "The trailing dash removes. Key alone removes all effects for that key; key:Effect- removes one specific taint. Same dash idiom removes labels (kubectl label node node01 disk-).",
  },
  {
    id: "ws-q-toleration-placement",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "node01 is tainted `dedicated=gpu:NoSchedule`. You add a matching toleration to a pod. What does the toleration guarantee?",
    options: [
      "Nothing about placement — it only ALLOWS scheduling onto node01",
      "The pod will be scheduled on node01",
      "The pod is evicted from other nodes onto node01",
      "node01 stops accepting pods without the toleration",
    ],
    correctAnswer: "Nothing about placement — it only ALLOWS scheduling onto node01",
    explanation:
      "Tolerations remove the repulsion; they don't attract. The scheduler may still pick any untainted node. Forcing the pod ONTO node01 needs nodeSelector/affinity on top — the exam's dedicated-node combo.",
  },
  {
    id: "ws-q-hpa-unknown",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt: "`kubectl get hpa` shows TARGETS `<unknown>/70%` and the HPA never scales. Root cause?",
    options: [
      "The target pods define no CPU request",
      "min and max replicas are equal",
      "The HPA needs --record",
      "CPU limits are missing on the nodes",
    ],
    correctAnswer: "The target pods define no CPU request",
    explanation:
      "HPA percentage targets are computed against the pod's CPU REQUEST. No request → utilization is undefined → <unknown>. (A dead metrics-server produces the same symptom — but requests are the fix you control in a task.)",
  },
  {
    id: "ws-q-configmap-env-update",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "You edit a ConfigMap consumed via envFrom. The pods keep using old values. Correct next step?",
    options: [
      "kubectl rollout restart deployment <name>",
      "Nothing — env vars refresh within a minute",
      "Delete and recreate the ConfigMap",
      "kubectl apply the ConfigMap with --force",
    ],
    correctAnswer: "kubectl rollout restart deployment <name>",
    explanation:
      "Environment variables are injected once at container start and never updated. Only fresh containers see new values — rollout restart replaces the pods gracefully. (Volume-mounted keys, by contrast, do refresh in place.)",
  },
  {
    id: "ws-q-init-container-crash",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt: "A pod shows status `Init:CrashLoopBackOff`. What does that tell you?",
    options: [
      "One of its init containers is failing and restarting — the main containers haven't started at all yet",
      "The main container crashed during its first few seconds of life",
      "An initContainer succeeded but the main container's image can't be pulled",
      "The pod's readiness probe is failing during startup",
    ],
    correctAnswer:
      "One of its init containers is failing and restarting — the main containers haven't started at all yet",
    explanation:
      "Init containers run sequentially, in order, and every one must exit 0 before any app container starts. Init:CrashLoopBackOff means kubelet keeps restarting a failing init container — check its logs with `kubectl logs <pod> -c <init-container-name>`.",
  },
  {
    id: "ws-q-job-completions-parallelism",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt: "A Job sets `completions: 5` and `parallelism: 2`. What does this mean?",
    options: [
      "5 pods must complete successfully in total, at most 2 running concurrently at any time",
      "Exactly 2 pods run, each must complete 5 times",
      "5 pods run concurrently, exactly 2 must succeed",
      "It's invalid — completions and parallelism must be equal",
    ],
    correctAnswer: "5 pods must complete successfully in total, at most 2 running concurrently at any time",
    explanation:
      "completions is the target number of successful pod completions overall; parallelism caps how many pods the Job runs at once while working toward that target. They're independent knobs, not required to match.",
  },
  {
    id: "ws-q-cronjob-concurrency",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "A CronJob's previous run is still executing when the next scheduled time arrives. With `concurrencyPolicy: Forbid`, what happens?",
    options: [
      "The new run is skipped entirely — it does not queue and does not run later",
      "The new run queues and starts as soon as the previous one finishes",
      "The previous run is killed and replaced by the new one",
      "Both runs execute concurrently, as normal",
    ],
    correctAnswer: "The new run is skipped entirely — it does not queue and does not run later",
    explanation:
      "Forbid simply skips the overlapping run (counted as a missed run) — it does NOT queue it for later. Replace kills the old run and starts the new one instead; the default, Allow, runs both concurrently.",
  },
  {
    id: "ws-q-pdb-scope",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "A PodDisruptionBudget sets `minAvailable: 2` for a Deployment with 3 replicas. A node hosting one of its pods suddenly crashes (hardware failure). What happens?",
    options: [
      "The pod is lost immediately — PDBs only block VOLUNTARY disruptions like drain/evict, not involuntary node failures",
      "The crash is blocked/delayed until another pod is available, per the PDB",
      "Kubernetes refuses to let the node fail while the PDB is active",
      "The Deployment is paused until minAvailable is satisfied again",
    ],
    correctAnswer:
      "The pod is lost immediately — PDBs only block VOLUNTARY disruptions like drain/evict, not involuntary node failures",
    explanation:
      "A PDB is consulted by the Eviction API — used by `kubectl drain`, cluster-autoscaler, etc. — for voluntary disruptions. It has zero effect on involuntary ones (node crashes, OOM kills, kernel panics); those just happen, and the Deployment controller reconciles by scheduling a replacement pod elsewhere.",
  },
  {
    id: "ws-q-pdb-both-fields",
    domainId: "workloads-scheduling",
    type: "yaml-fix",
    prompt: `This PodDisruptionBudget is rejected by the API server. Why?

\`\`\`yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2
  maxUnavailable: 1
  selector:
    matchLabels:
      app: web
\`\`\``,
    correctAnswer: "minAvailable and maxUnavailable are mutually exclusive — set only one",
    acceptableAnswers: [
      "can't set both minAvailable and maxUnavailable",
      "remove one of minAvailable or maxUnavailable",
      "only one of minAvailable/maxUnavailable is allowed",
    ],
    explanation:
      "A PDB accepts exactly one of minAvailable or maxUnavailable, never both — they're two ways of expressing the same budget, and the API rejects a spec that sets both.",
  },
  {
    id: "ws-q-node-affinity-hard-soft",
    domainId: "workloads-scheduling",
    type: "multiple-choice",
    prompt:
      "Which nodeAffinity term is a HARD requirement (the scheduler will not place the pod otherwise), as opposed to a preference?",
    options: [
      "requiredDuringSchedulingIgnoredDuringExecution",
      "preferredDuringSchedulingIgnoredDuringExecution",
      "requiredDuringExecution",
      "weightedPodAffinityTerm",
    ],
    correctAnswer: "requiredDuringSchedulingIgnoredDuringExecution",
    explanation:
      "'required...' is a hard constraint the scheduler must satisfy to place the pod at all; 'preferred...' is best-effort (weighted), and the pod can still land elsewhere if no node satisfies it. 'IgnoredDuringExecution' in both means already-running pods aren't evicted if node labels change later.",
  },
  {
    id: "ws-q-scheduler-uses-requests",
    domainId: "workloads-scheduling",
    type: "command-fill",
    prompt:
      "The scheduler's bin-packing decision (does this node have room for this pod?) is based on a container's `resources.___` field, not its limits.",
    correctAnswer: "requests",
    acceptableAnswers: ["requests", "resources.requests"],
    explanation:
      "Requests are what the scheduler reserves against a node's allocatable capacity. Limits only bound actual runtime usage (throttling CPU, or OOM-killing on memory) — a node can be scheduled full of pods whose limits, if all hit simultaneously, would exceed its physical capacity.",
  },
  {
    id: "ws-q-rollout-undo",
    domainId: "workloads-scheduling",
    type: "command-fill",
    prompt:
      "Deployment `web` just rolled out a bad image. Roll it back to revision 3 specifically (not just 'one step back'):",
    correctAnswer: "kubectl rollout undo deployment/web --to-revision=3",
    acceptableAnswers: [
      "kubectl rollout undo deployment/web --to-revision=3",
      "kubectl rollout undo deployment web --to-revision=3",
      "k rollout undo deployment/web --to-revision=3",
    ],
    explanation:
      "--to-revision=N targets a specific entry in the Deployment's revision history (see kubectl rollout history deployment/web); omitting it just undoes to the immediately-previous revision.",
  },
];

export default quiz;
