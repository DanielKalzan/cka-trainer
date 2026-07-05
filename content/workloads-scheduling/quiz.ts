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
];

export default quiz;
