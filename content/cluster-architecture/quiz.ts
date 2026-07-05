import type { QuizQuestion } from "@/lib/types/content";

const quiz: QuizQuestion[] = [
  {
    id: "ca-q-etcd-restore-flag",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "You've restored an etcd snapshot with `etcdctl snapshot restore /opt/etcd.db --data-dir=/var/lib/etcd-new`. Which file do you edit next to make the cluster use it?",
    correctAnswer: "/etc/kubernetes/manifests/etcd.yaml",
    acceptableAnswers: ["etcd.yaml", "/etc/kubernetes/manifests/etcd.yaml"],
    explanation:
      "Restore only unpacks data to a new directory. The running etcd is a static pod; pointing its etcd-data hostPath volume at /var/lib/etcd-new (in /etc/kubernetes/manifests/etcd.yaml) makes kubelet recreate it against the restored data.",
  },
  {
    id: "ca-q-etcd-certs",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt:
      "`etcdctl snapshot save` fails with a TLS handshake error. Which flag set fixes it?",
    options: [
      "--cacert, --cert, --key pointing at /etc/kubernetes/pki/etcd/",
      "--insecure-skip-tls-verify=true",
      "--token from /var/run/secrets/kubernetes.io/serviceaccount",
      "--kubeconfig=/etc/kubernetes/admin.conf",
    ],
    correctAnswer: "--cacert, --cert, --key pointing at /etc/kubernetes/pki/etcd/",
    explanation:
      "etcdctl talks to etcd directly over mTLS — kubeconfigs and SA tokens are API-server concepts and do nothing here. The cert paths are readable from the etcd static pod manifest.",
  },
  {
    id: "ca-q-upgrade-order",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt: "Correct order for upgrading a control-plane node with kubeadm?",
    options: [
      "upgrade kubeadm pkg → kubeadm upgrade apply → drain → upgrade kubelet → restart kubelet → uncordon",
      "drain → upgrade kubelet → kubeadm upgrade apply → uncordon",
      "upgrade kubelet → kubeadm upgrade apply → drain → uncordon",
      "kubeadm upgrade apply → upgrade kubeadm pkg → drain → upgrade kubelet → uncordon",
    ],
    correctAnswer:
      "upgrade kubeadm pkg → kubeadm upgrade apply → drain → upgrade kubelet → restart kubelet → uncordon",
    explanation:
      "kubeadm (the package) must be upgraded before it can apply the new control-plane version; kubelet is upgraded only after the control plane, with the node drained; uncordon is the step graders check and people forget.",
  },
  {
    id: "ca-q-clusterrole-rolebinding",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt:
      "A task says: grant the existing ClusterRole `view` to ServiceAccount `ci` — but only in namespace `build`. What do you create?",
    options: [
      "A RoleBinding in build referencing ClusterRole view",
      "A ClusterRoleBinding referencing ClusterRole view",
      "A Role in build copying view's rules, plus a RoleBinding",
      "Nothing — ClusterRoles always apply cluster-wide",
    ],
    correctAnswer: "A RoleBinding in build referencing ClusterRole view",
    explanation:
      "A RoleBinding may reference a ClusterRole, which scopes those rules to the binding's namespace. `kubectl create rolebinding ci-view --clusterrole=view --serviceaccount=build:ci -n build`.",
  },
  {
    id: "ca-q-rbac-verify",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "One command to verify ServiceAccount `app-sa` in namespace `dev` can list pods there (impersonation, not guessing):",
    correctAnswer:
      "kubectl auth can-i list pods --as=system:serviceaccount:dev:app-sa -n dev",
    acceptableAnswers: [
      "kubectl auth can-i list pods --as=system:serviceaccount:dev:app-sa --namespace=dev",
      "kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:app-sa",
    ],
    explanation:
      "kubectl auth can-i with --as=system:serviceaccount:<ns>:<name> is the canonical RBAC self-check; it returns yes/no from the server's authorizer, not your guess.",
  },
  {
    id: "ca-q-static-pod-yaml",
    domainId: "cluster-architecture",
    type: "yaml-fix",
    prompt: `This static pod manifest was dropped into /etc/kubernetes/manifests/ on node01 but the pod never appears. Find the problem:

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: audit-logger
  namespace: kube-system
spec:
  nodeName: controlplane
  containers:
    - name: logger
      image: busybox:1.36
      command: ["sh", "-c", "tail -f /dev/null"]
\`\`\``,
    correctAnswer: "Remove the nodeName field",
    acceptableAnswers: [
      "delete nodeName",
      "remove nodeName: controlplane",
      "nodeName must not be set",
    ],
    explanation:
      "Static pods are bound to the node whose kubelet reads the manifest — node01 here. Setting nodeName: controlplane conflicts with kubelet's own binding and the mirror pod never materializes. Static pod manifests never set nodeName.",
  },
];

export default quiz;
