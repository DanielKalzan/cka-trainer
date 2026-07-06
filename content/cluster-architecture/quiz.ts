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
  {
    id: "ca-q-init-pod-network-cidr",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "Deploying Flannel (expects pod CIDR 10.244.0.0/16). Which `kubeadm init` flag must you set to match it?",
    correctAnswer: "--pod-network-cidr=10.244.0.0/16",
    acceptableAnswers: [
      "--pod-network-cidr=10.244.0.0/16",
      "--pod-network-cidr",
      "kubeadm init --pod-network-cidr=10.244.0.0/16",
    ],
    explanation:
      "--pod-network-cidr tells kubeadm the range to reserve for pod IPs; it must match what the CNI plugin (here Flannel) expects, or pod networking breaks once the CNI is applied.",
  },
  {
    id: "ca-q-join-token",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "You're on an existing control-plane node and need to add a new worker. One command to generate a fresh join command (token + discovery hash) to run on the worker?",
    correctAnswer: "kubeadm token create --print-join-command",
    acceptableAnswers: ["kubeadm token create --print-join-command"],
    explanation:
      "kubeadm tokens expire (24h by default); token create --print-join-command mints a new one and prints the full ready-to-run `kubeadm join ...` command, discovery hash included.",
  },
  {
    id: "ca-q-context-switch",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "kubeconfig has contexts for `dev-cluster` and `prod-cluster`. Switch kubectl's active context to `prod-cluster`:",
    correctAnswer: "kubectl config use-context prod-cluster",
    acceptableAnswers: ["kubectl config use-context prod-cluster", "k config use-context prod-cluster"],
    explanation:
      "use-context changes which context (cluster+user+namespace triple) subsequent kubectl commands use, without hand-editing the kubeconfig file.",
  },
  {
    id: "ca-q-default-namespace",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "Set the CURRENT context's default namespace to `billing`, so you stop typing `-n billing` on every command:",
    correctAnswer: "kubectl config set-context --current --namespace=billing",
    acceptableAnswers: [
      "kubectl config set-context --current --namespace=billing",
      "k config set-context --current --namespace=billing",
      "kubectl config set-context --current --namespace billing",
    ],
    explanation:
      "--current targets whichever context is active right now, avoiding a lookup of its name. This only changes the default — a single command can still override it with -n.",
  },
  {
    id: "ca-q-csr-approve",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "A new kubelet's CertificateSigningRequest, `csr-x7f2p`, is sitting Pending. Approve it:",
    correctAnswer: "kubectl certificate approve csr-x7f2p",
    acceptableAnswers: ["kubectl certificate approve csr-x7f2p", "k certificate approve csr-x7f2p"],
    explanation:
      "kubectl certificate approve signs the CSR via the certificates.k8s.io API, letting kube-controller-manager issue the certificate. (`certificate deny` works the same way to reject one.)",
  },
  {
    id: "ca-q-role-scope",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt: "A Role (not ClusterRole) is created in namespace `build`. Which of these can it grant access to?",
    options: [
      "Pods and ConfigMaps inside build",
      "Nodes cluster-wide",
      "PersistentVolumes cluster-wide",
      "Namespaces themselves",
    ],
    correctAnswer: "Pods and ConfigMaps inside build",
    explanation:
      "A Role only grants access to namespaced resources, scoped to its own namespace. Nodes, PersistentVolumes, and Namespace objects are cluster-scoped — only a ClusterRole can grant access to them.",
  },
  {
    id: "ca-q-resourcenames-gotcha",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt:
      'A Role grants `get`, `update` on secrets with `resourceNames: ["db-creds"]`. What can the bound user actually do?',
    options: [
      "get/update only db-creds — but kubectl get secrets (list) still returns ALL secrets in the namespace",
      "get/update only db-creds, and list also only returns db-creds",
      "Nothing — resourceNames requires a matching verb of 'get' only",
      "get/update on every secret, since resourceNames only affects delete",
    ],
    correctAnswer:
      "get/update only db-creds — but kubectl get secrets (list) still returns ALL secrets in the namespace",
    explanation:
      "resourceNames restricts get/update/delete/patch to the named object(s), but list and watch cannot be restricted by resourceNames at all — if list is granted, it returns every secret in the namespace regardless of the resourceNames filter.",
  },
  {
    id: "ca-q-sa-automount",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt: "Pods using ServiceAccount `batch-sa` should NOT get an auto-mounted API token. Where do you set that?",
    options: [
      "automountServiceAccountToken: false on the ServiceAccount (or overridden per-Pod)",
      "disableAutomount: true on the Namespace",
      "It can only be disabled cluster-wide, via API server flags",
      "Delete the default token Secret for that ServiceAccount",
    ],
    correctAnswer: "automountServiceAccountToken: false on the ServiceAccount (or overridden per-Pod)",
    explanation:
      "automountServiceAccountToken exists on both ServiceAccount and Pod spec; the Pod-level setting, if present, wins over the ServiceAccount's. Setting it on the ServiceAccount is the common way to opt every pod using it out by default.",
  },
  {
    id: "ca-q-kubeadm-upgrade-node",
    domainId: "cluster-architecture",
    type: "multiple-choice",
    prompt:
      "A cluster has 3 control-plane nodes. During a kubeadm upgrade, which command runs on the 2nd and 3rd control-plane nodes?",
    options: [
      "kubeadm upgrade node",
      "kubeadm upgrade apply",
      "kubeadm upgrade plan",
      "kubeadm init phase upload-config",
    ],
    correctAnswer: "kubeadm upgrade node",
    explanation:
      "kubeadm upgrade apply runs exactly once, on the first control-plane node, and fetches/applies the new cluster-wide config. Every other control-plane node — and every worker — runs kubeadm upgrade node instead.",
  },
  {
    id: "ca-q-static-pod-mirror-name",
    domainId: "cluster-architecture",
    type: "command-fill",
    prompt:
      "Static pod manifest `kube-apiserver.yaml` sits on node `cp1`. What name does `kubectl get pods -n kube-system` show for its mirror pod?",
    correctAnswer: "kube-apiserver-cp1",
    acceptableAnswers: ["kube-apiserver-cp1"],
    explanation:
      "kubelet names a static pod's mirror pod <manifest-pod-name>-<node-name>, so the API-visible object is always identifiable back to the node running it.",
  },
  {
    id: "ca-q-rolebinding-roleref-kind",
    domainId: "cluster-architecture",
    type: "yaml-fix",
    prompt: `\`view\` is a built-in ClusterRole, not a Role in \`build\`. Why does this RoleBinding fail to grant anything?

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ci-view
  namespace: build
subjects:
- kind: ServiceAccount
  name: ci
  namespace: build
roleRef:
  kind: Role
  name: view
  apiGroup: rbac.authorization.k8s.io
\`\`\``,
    correctAnswer: "roleRef.kind should be ClusterRole, not Role — it must match the actual kind of the object named 'view'",
    acceptableAnswers: [
      "roleRef.kind should be ClusterRole",
      "change kind to ClusterRole",
      "roleRef must reference the correct kind matching the existing object",
    ],
    explanation:
      "roleRef names both a kind and a name; the API looks up exactly that (kind, name) pair. Since 'view' only exists as a ClusterRole, a roleRef of kind Role pointing at 'view' finds nothing valid and the binding grants no permissions.",
  },
  {
    id: "ca-q-serviceaccount-subject-kind",
    domainId: "cluster-architecture",
    type: "yaml-fix",
    prompt: `This RoleBinding was meant to bind the \`default\` ServiceAccount in \`build\`. Why doesn't it work?

\`\`\`yaml
subjects:
- kind: User
  name: default
  namespace: build
roleRef:
  kind: ClusterRole
  name: view
  apiGroup: rbac.authorization.k8s.io
\`\`\``,
    correctAnswer:
      "subjects[].kind should be ServiceAccount, not User — 'User' refers to an external/human identity, not the ServiceAccount named default",
    acceptableAnswers: [
      "kind should be ServiceAccount",
      "change kind: User to kind: ServiceAccount",
      "subject kind is wrong, use ServiceAccount",
    ],
    explanation:
      "RBAC subjects distinguish User, Group, and ServiceAccount kinds even when the name is identical. kind: User with name: default matches a user identity called 'default' (which doesn't exist as such) — never the ServiceAccount object of the same name.",
  },
];

export default quiz;
