import type { QuizQuestion } from "@/lib/types/content";

const quiz: QuizQuestion[] = [
  {
    id: "ts-q-crashloop-logs",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "Pod `api-7d9f` is in CrashLoopBackOff. The current container hasn't produced output yet. What command shows why the last run died?",
    correctAnswer: "kubectl logs api-7d9f --previous",
    acceptableAnswers: [
      "kubectl logs api-7d9f --previous",
      "kubectl logs api-7d9f -p",
      "kubectl logs --previous api-7d9f",
      "k logs api-7d9f --previous",
      "k logs api-7d9f -p",
    ],
    explanation:
      "--previous (-p) prints the log of the last terminated container instance. In a crash loop the fresh container usually dies before logging anything — the evidence is always in the previous run.",
  },
  {
    id: "ts-q-pending-causes",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt: "A pod is stuck `Pending` and describe shows no events about volumes. Which is NOT a plausible cause?",
    options: [
      "The container image tag doesn't exist in the registry",
      "Every node has a NoSchedule taint the pod doesn't tolerate",
      "The pod's CPU request exceeds free capacity on all nodes",
      "The pod's nodeSelector matches no node labels",
    ],
    correctAnswer: "The container image tag doesn't exist in the registry",
    explanation:
      "Image problems happen AFTER scheduling — they show as ErrImagePull/ImagePullBackOff on a scheduled pod. Pending means the scheduler can't place the pod at all: taints, insufficient resources, or selector/affinity mismatches.",
  },
  {
    id: "ts-q-notready-first",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt: "Node `node01` reports NotReady. After ssh'ing to it, your FIRST command is:",
    options: [
      "systemctl status kubelet",
      "kubectl delete node node01",
      "reboot",
      "crictl rm --all",
    ],
    correctAnswer: "systemctl status kubelet",
    explanation:
      "NotReady almost always means the kubelet stopped or can't talk to the API server. Check its status, then journalctl -u kubelet for the reason. Deleting the node object or rebooting destroys evidence and usually points.",
  },
  {
    id: "ts-q-static-pod-dir",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "kube-apiserver is down on a kubeadm cluster, so kubectl is useless. In which directory do you inspect/fix its manifest?",
    correctAnswer: "/etc/kubernetes/manifests",
    acceptableAnswers: ["/etc/kubernetes/manifests", "/etc/kubernetes/manifests/"],
    explanation:
      "Control-plane components run as static pods managed directly by kubelet from /etc/kubernetes/manifests. Fix the YAML file there; kubelet reconciles automatically — no kubectl needed (or possible).",
  },
  {
    id: "ts-q-endpoints-empty",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt: "`kubectl get endpoints web-svc` shows no addresses. The most likely cause?",
    options: [
      "The Service selector doesn't match any Ready pod's labels",
      "CoreDNS is down",
      "The Service type should be NodePort",
      "kube-proxy needs a restart",
    ],
    correctAnswer: "The Service selector doesn't match any Ready pod's labels",
    explanation:
      "Endpoints are computed purely from selector ↔ pod-label matching (plus pod readiness). DNS and kube-proxy failures break reaching the service, but the endpoints list would still be populated.",
  },
  {
    id: "ts-q-oom",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "describe pod shows `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. The durable fix is:",
    options: [
      "Raise (or set correctly) the container's memory limit",
      "Restart the kubelet on that node",
      "Add a toleration for memory pressure",
      "Increase the liveness probe timeout",
    ],
    correctAnswer: "Raise (or set correctly) the container's memory limit",
    explanation:
      "137 = SIGKILL from the kernel OOM killer: the container exceeded its memory limit. Nothing node- or probe-related changes that. Raise the limit (or fix the app's memory use).",
  },
  {
    id: "ts-q-events-timeline",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "You don't know yet which object is broken. What command shows all events in the cluster ordered by time?",
    correctAnswer: "kubectl get events -A --sort-by=.metadata.creationTimestamp",
    acceptableAnswers: [
      "kubectl get events -A --sort-by=.metadata.creationTimestamp",
      "kubectl get events --all-namespaces --sort-by=.metadata.creationTimestamp",
      "kubectl get events --sort-by=.metadata.creationTimestamp -A",
      "k get events -A --sort-by=.metadata.creationTimestamp",
    ],
    explanation:
      "Cluster-wide, time-sorted events surface the failure sequence without knowing the victim in advance. Unsorted event output is close to useless under time pressure.",
  },
];

export default quiz;
