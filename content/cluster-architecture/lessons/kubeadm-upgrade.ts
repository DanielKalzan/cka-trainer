import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ca-kubeadm-upgrade",
  domainId: "cluster-architecture",
  title: "kubeadm cluster upgrades without wrong turns",
  estMinutes: 15,
  body: `
Upgrade tasks are long but mechanical. The danger isn't difficulty — it's sequencing mistakes and wasted minutes. Burn this order in:

## Control plane node

\`\`\`bash
# 1. Find the target version of the kubeadm PACKAGE first
apt-cache madison kubeadm        # or: apt list -a kubeadm

# 2. Upgrade kubeadm itself
apt-get update && apt-get install -y kubeadm=1.35.2-1.1

# 3. Plan, then apply
kubeadm upgrade plan
kubeadm upgrade apply v1.35.2

# 4. Drain BEFORE touching kubelet
kubectl drain controlplane --ignore-daemonsets

# 5. Upgrade kubelet + kubectl packages
apt-get install -y kubelet=1.35.2-1.1 kubectl=1.35.2-1.1
systemctl daemon-reload && systemctl restart kubelet

# 6. Uncordon
kubectl uncordon controlplane
\`\`\`

## Worker nodes

Same shape, two differences: run \`kubeadm upgrade node\` (not \`apply\`), and run the drain/uncordon **from the control plane** (workers usually lack a kubeconfig):

\`\`\`bash
kubectl drain node01 --ignore-daemonsets          # from control plane
# then ON node01:
apt-get install -y kubeadm=1.35.2-1.1
kubeadm upgrade node
apt-get install -y kubelet=1.35.2-1.1 kubectl=1.35.2-1.1
systemctl daemon-reload && systemctl restart kubelet
# back on control plane:
kubectl uncordon node01
\`\`\`

## The traps

- **Version skew**: kubelet may be at most one minor version behind the API server, and you can only upgrade one minor version at a time (1.34 → 1.35, never 1.34 → 1.36).
- **Package vs release version**: apt wants \`1.35.2-1.1\`; kubeadm wants \`v1.35.2\`. Mixing these up costs a re-type.
- **Drain says "cannot delete DaemonSet-managed pods"**: that's what \`--ignore-daemonsets\` is for. If it complains about pods with local storage or bare pods, add \`--delete-emptydir-data\` / \`--force\` — but only when the task says data loss is OK.
- \`kubeadm upgrade plan\` is free information: it prints the exact \`kubeadm upgrade apply vX.Y.Z\` line to copy.

## Where does the apt repo come from?

Since the community repos, each minor version has its own repo line in \`/etc/apt/sources.list.d/kubernetes.list\` (e.g. \`.../core:/stable:/v1.35/deb/\`). If \`apt-cache madison\` doesn't show your target minor, edit that file to bump the minor version, then \`apt-get update\`. Exam tasks that cross a minor boundary expect this edit.
`,
  tips: [
    {
      type: "exam-tip",
      text: "Order that must be cold: upgrade kubeadm pkg → kubeadm upgrade plan/apply → drain → upgrade kubelet+kubectl → restart kubelet → uncordon. Workers use 'kubeadm upgrade node'.",
    },
    {
      type: "exam-tip",
      text: "Forgetting to uncordon is the classic silent point-loss — the task grader checks node schedulability. Make uncordon a reflex ending to every drain.",
    },
    {
      type: "deep-dive",
      text: "'kubeadm upgrade apply' rewrites the static pod manifests in /etc/kubernetes/manifests one component at a time and waits for each to come healthy — that's why it takes minutes and why you don't touch manifests during it.",
    },
    {
      type: "deep-dive",
      text: "Control plane components can be one minor ahead of kubelet because the API server is the compatibility anchor; kubectl is supported within ±1 minor of the server.",
    },
  ],
};

export default lesson;
