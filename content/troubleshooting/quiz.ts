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
  {
    id: "ts-q-rbac-forbidden",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      'User `dev` gets `Error from server (Forbidden): pods is forbidden: User "dev" cannot list resource "pods" in API group "" in the namespace "default"` when running `kubectl get pods`. What single command would have predicted this failure *before* they ran it (as an admin impersonating them)?',
    correctAnswer: "kubectl auth can-i list pods --as dev -n default",
    acceptableAnswers: [
      "kubectl auth can-i list pods --as dev -n default",
      "kubectl auth can-i list pods --as=dev -n default",
      "kubectl auth can-i list pods --as dev --namespace default",
      "kubectl auth can-i list pods --as=dev --namespace=default",
      "k auth can-i list pods --as dev -n default",
    ],
    explanation:
      "kubectl auth can-i --as <user> impersonates the user against the RBAC authorizer without them needing to run anything. It's the fastest way to reproduce a Forbidden error and to test a fix (new Role/RoleBinding) before handing control back.",
  },
  {
    id: "ts-q-etcd-snapshot-save",
    domainId: "troubleshooting",
    type: "command-fill",
    // TODO: verify whether the ETCDCTL_API=3 prefix is still required (vs a no-op)
    // on the etcdctl binary version shipped in the current CKA exam cluster —
    // etcd 3.4+ defaults to the v3 API, but kubeadm's bundled etcdctl build has
    // historically still needed the env var set explicitly on some versions.
    prompt:
      "Before a risky change, you need a point-in-time etcd backup. What's the exact command (with certs) to snapshot etcd to `/opt/backup/etcd.db` on a kubeadm control-plane node?",
    correctAnswer:
      "ETCDCTL_API=3 etcdctl snapshot save /opt/backup/etcd.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key",
    acceptableAnswers: [
      "ETCDCTL_API=3 etcdctl snapshot save /opt/backup/etcd.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key",
      "etcdctl snapshot save /opt/backup/etcd.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key",
    ],
    explanation:
      "The four flags point etcdctl at the running etcd endpoint and its mutual-TLS material (all under /etc/kubernetes/pki/etcd/ on a kubeadm cluster) so it can talk to etcd directly, bypassing the API server entirely. Always verify with `etcdctl snapshot status` afterward.",
  },
  {
    id: "ts-q-etcd-restore-datadir",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "You ran `etcdctl snapshot restore etcd.db --data-dir /var/lib/etcd-restored`. Etcd is still serving old data. What MUST you do next?",
    options: [
      "Edit the etcd static pod manifest's hostPath volume to point at /var/lib/etcd-restored, so kubelet restarts etcd against the restored data",
      "Nothing — restore takes effect immediately for the running etcd process",
      "Run `kubectl rollout restart` on the etcd Deployment",
      "Delete and recreate the etcd Service object",
    ],
    correctAnswer:
      "Edit the etcd static pod manifest's hostPath volume to point at /var/lib/etcd-restored, so kubelet restarts etcd against the restored data",
    explanation:
      "snapshot restore only materializes a brand-new data directory on disk — it never touches the running etcd process. Etcd is a static pod (not a Deployment, no Service in front of it); you must repoint its manifest's hostPath at the new directory so kubelet tears down and recreates the static pod against the restored data.",
  },
  {
    id: "ts-q-kubeadm-upgrade-order",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "Upgrading a kubeadm cluster (1 control-plane, 2 workers) by one minor version. What's the correct order?",
    options: [
      "kubeadm + control-plane node first (upgrade plan/apply, then kubelet/kubectl on it), then drain+upgrade each worker one at a time",
      "Upgrade all worker kubelets simultaneously first, then the control plane",
      "Upgrade kubectl everywhere first, then kubeadm everywhere at once",
      "Drain and upgrade the control-plane node's kubelet before running kubeadm upgrade apply on it",
    ],
    correctAnswer:
      "kubeadm + control-plane node first (upgrade plan/apply, then kubelet/kubectl on it), then drain+upgrade each worker one at a time",
    explanation:
      "kubeadm upgrade always goes control plane before workers, and workers one at a time (drain, upgrade kubeadm/kubelet, uncordon) to preserve availability. On the control-plane node itself, kubeadm upgrade apply must run BEFORE touching kubelet/kubectl — kubeadm reconfigures the static pod manifests first.",
  },
  {
    id: "ts-q-taint-vs-affinity",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "You tainted the GPU node `nvidia.com/gpu=true:NoSchedule` and gave your pod a matching toleration, but the pod still lands on a random CPU-only node. What's missing?",
    options: [
      "A toleration only lets the pod land on a tainted node — it doesn't attract it there. Add a nodeSelector/nodeAffinity for the GPU node too",
      "The taint effect should be PreferNoSchedule instead of NoSchedule",
      "The toleration's operator must be Equal instead of Exists",
      "The pod needs spec.nodeName set explicitly",
    ],
    correctAnswer:
      "A toleration only lets the pod land on a tainted node — it doesn't attract it there. Add a nodeSelector/nodeAffinity for the GPU node too",
    explanation:
      "Taints/tolerations are a repulsion mechanism: they only decide which pods are ALLOWED on a tainted node, never which node a pod prefers. To actually steer a pod TO specific nodes you need nodeSelector or nodeAffinity — the two mechanisms are complementary, not substitutes.",
  },
  {
    id: "ts-q-dns-nslookup",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "Pods can reach each other by IP but service names don't resolve. What's the fastest first check, run from inside a pod?",
    correctAnswer: "nslookup kubernetes.default",
    acceptableAnswers: [
      "nslookup kubernetes.default",
      "nslookup kubernetes.default.svc.cluster.local",
      "nslookup kubernetes",
    ],
    explanation:
      "kubernetes.default always exists, so nslookup-ing it isolates the problem to DNS/CoreDNS immediately: if it fails, check CoreDNS pods, the kube-dns Service, and /etc/resolv.conf in the pod; if it resolves, the problem is elsewhere (NetworkPolicy, the specific service's selector, etc.).",
  },
  {
    id: "ts-q-liveness-vs-readiness",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "A pod's RESTARTS count keeps climbing even though the app is healthy but slow to boot (~30s). Most likely misconfiguration?",
    options: [
      "livenessProbe's initialDelaySeconds is too low, so kubelet kills the container before it's finished starting",
      "readinessProbe's initialDelaySeconds is too low",
      "The container has no resource limits set",
      "The probe is using the wrong protocol (TCP vs HTTP)",
    ],
    correctAnswer:
      "livenessProbe's initialDelaySeconds is too low, so kubelet kills the container before it's finished starting",
    explanation:
      "Only a FAILING LIVENESS probe causes a restart (kubelet kills and recreates the container). A failing readiness probe just pulls the pod out of Service endpoints — no restart, no RESTARTS increment. Restarts plus a slow-starting app point straight at liveness timing, not readiness.",
  },
  {
    id: "ts-q-probe-delay-string",
    domainId: "troubleshooting",
    type: "yaml-fix",
    prompt: `This container spec is rejected by the API server on apply. Which field is invalid, and why?

\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: "3s"
  periodSeconds: 5
\`\`\``,
    correctAnswer: 'initialDelaySeconds must be an integer, not the string "3s"',
    acceptableAnswers: [
      'initialDelaySeconds must be an integer, not the string "3s"',
      'initialDelaySeconds should be 3, not "3s"',
      "remove the quotes and s suffix from initialDelaySeconds",
      "initialDelaySeconds is an integer field",
    ],
    explanation:
      'Probe timing fields (initialDelaySeconds, periodSeconds, timeoutSeconds, etc.) are plain integers counted in seconds — unlike resource quantities, they don\'t accept duration-style strings like "3s". Quoting one turns it into a string and fails schema validation.',
  },
  {
    id: "ts-q-static-vs-daemonset",
    domainId: "troubleshooting",
    type: "multiple-choice",
    prompt:
      "You `kubectl delete` a pod and it instantly reappears with the same name suffix. `kubectl get daemonset -A` shows nothing that would own it. What is it?",
    options: [
      "A static pod — kubelet recreates it from a manifest in /etc/kubernetes/manifests, deleting via the API only kills the mirror pod object briefly",
      "A DaemonSet pod that isn't showing due to an RBAC issue",
      "A Job with restartPolicy: Always",
      "A pod protected by a PodDisruptionBudget",
    ],
    correctAnswer:
      "A static pod — kubelet recreates it from a manifest in /etc/kubernetes/manifests, deleting via the API only kills the mirror pod object briefly",
    explanation:
      "Static pods (e.g. kube-apiserver, etcd) are managed by kubelet reading /etc/kubernetes/manifests directly, not by any controller visible via the API. Deleting the mirror pod object doesn't stop kubelet from recreating it — you have to edit/remove the manifest file on that node instead. DaemonSet pods, by contrast, are always visible via `kubectl get daemonset`.",
  },
  {
    id: "ts-q-requests-exceed-limits",
    domainId: "troubleshooting",
    type: "yaml-fix",
    prompt: `This pod is rejected outright by the API server — it never even reaches Pending. What's wrong?

\`\`\`yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "250m"
    memory: "256Mi"
\`\`\``,
    correctAnswer: "cpu request (500m) is greater than the cpu limit (250m)",
    acceptableAnswers: [
      "cpu request (500m) is greater than the cpu limit (250m)",
      "cpu requests must be <= cpu limits",
      "requests.cpu exceeds limits.cpu",
      "lower the cpu request to 250m or below",
    ],
    explanation:
      "For any resource, requests must be ≤ limits — the API server validates this at admission and rejects the object outright (an Invalid error) if it isn't. That's why this fails before scheduling: it never becomes a real pod, so `kubectl get pods` won't even show it.",
  },
  {
    id: "ts-q-drain-command",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "You need to take node01 down for maintenance and safely evict its pods first, including ones with local emptyDir data, without being blocked by DaemonSet-managed pods. What's the command?",
    correctAnswer: "kubectl drain node01 --ignore-daemonsets --delete-emptydir-data",
    acceptableAnswers: [
      "kubectl drain node01 --ignore-daemonsets --delete-emptydir-data",
      "kubectl drain node01 --delete-emptydir-data --ignore-daemonsets",
      "k drain node01 --ignore-daemonsets --delete-emptydir-data",
    ],
    explanation:
      "drain cordons the node (no new pods scheduled) and evicts existing ones. --ignore-daemonsets is required or drain refuses to proceed because DaemonSet pods are recreated regardless; --delete-emptydir-data is required or drain refuses because that data is about to be lost for good.",
  },
  {
    id: "ts-q-notready-pods-affected",
    domainId: "troubleshooting",
    type: "command-fill",
    prompt:
      "Node01 just went NotReady. Before deciding whether to drain or wait it out, what command lists every pod (any namespace) currently scheduled to it?",
    correctAnswer: "kubectl get pods -A --field-selector spec.nodeName=node01",
    acceptableAnswers: [
      "kubectl get pods -A --field-selector spec.nodeName=node01",
      "kubectl get pods --all-namespaces --field-selector spec.nodeName=node01",
      "kubectl get pods -A --field-selector=spec.nodeName=node01",
      "k get pods -A --field-selector spec.nodeName=node01",
    ],
    explanation:
      "--field-selector spec.nodeName=<node> filters server-side by scheduled node across all namespaces, showing you the blast radius before you act. (Pods on a NotReady node are marked Unknown/Terminating after the pod-eviction-timeout, but they still exist until then.)",
  },
  {
    id: "ts-q-configmap-missing-key",
    domainId: "troubleshooting",
    type: "yaml-fix",
    prompt: `This pod never reaches Running — it sits in CreateContainerConfigError. The ConfigMap \`app-config\` only defines the key \`DATABASE_HOST\`. What's wrong?

\`\`\`yaml
env:
  - name: DB_HOST
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: DB_HOST
\`\`\``,
    correctAnswer: "key: DB_HOST doesn't exist in the ConfigMap, which only has DATABASE_HOST",
    acceptableAnswers: [
      "key: DB_HOST doesn't exist in the ConfigMap, which only has DATABASE_HOST",
      "the configMapKeyRef key should be DATABASE_HOST",
      "wrong key name, should be DATABASE_HOST",
      "fix key to DATABASE_HOST",
    ],
    explanation:
      "configMapKeyRef.key must exactly match an existing key in the ConfigMap. A mismatch fails at container-creation time (CreateContainerConfigError) before the entrypoint ever runs — the container image is never even started.",
  },
];

export default quiz;
