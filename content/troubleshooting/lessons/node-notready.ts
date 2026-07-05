import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ts-node-notready",
  domainId: "troubleshooting",
  title: "Node NotReady: kubelet first, always",
  estMinutes: 10,
  body: `
A \`NotReady\` node is nearly always a **kubelet problem**. The exam gives you SSH access to the node — use it.

## The fixed sequence

\`\`\`bash
kubectl get nodes                        # confirm which node, how long NotReady
kubectl describe node node01             # Conditions + recent events
ssh node01
systemctl status kubelet                 # is it even running?
journalctl -u kubelet -f --no-pager      # WHY it's failing
\`\`\`

Then, in order of how often they appear on the exam:

1. **kubelet stopped/dead** → \`systemctl start kubelet\` and \`systemctl enable kubelet\` (enable, or it fails again on reboot — graders check).
2. **kubelet misconfigured** → journalctl names the bad file/flag. Usual suspects:
   - \`/var/lib/kubelet/config.yaml\` — wrong path to client CA, typo'd field
   - \`/etc/kubernetes/kubelet.conf\` — wrong API-server address/port
3. **Container runtime down** → \`systemctl status containerd\`, start it, then restart kubelet.
4. **Certificates expired** — journalctl says \`x509: certificate has expired\`.

After any fix: \`systemctl restart kubelet\`, then back on the control plane \`kubectl get nodes\` until Ready.

## Control-plane pods are static pods

If \`kube-apiserver\`/\`etcd\`/\`kube-scheduler\`/\`kube-controller-manager\` are broken, kubectl may not even work. Those run as **static pods** from \`/etc/kubernetes/manifests/\` on the control-plane node:

- kubelet watches that directory; fixing the YAML there is the fix — no \`kubectl apply\` involved.
- A typo in a static pod manifest = the pod silently never starts. Check \`crictl ps -a\` and kubelet logs.
- Moving a manifest OUT of the directory stops the pod; moving it back starts it. That's also the exam's way of "restarting" a control-plane component.

## Quick component health

\`\`\`bash
kubectl get pods -n kube-system                    # everything control-plane lives here
kubectl cluster-info                               # API server + CoreDNS endpoints
crictl ps -a                                       # on the node: containers incl. dead ones
\`\`\`
`,
  tips: [
    {
      type: "exam-tip",
      text: "systemctl enable --now kubelet does start + enable in one command. Forgetting 'enable' is a classic silent point loss.",
    },
    {
      type: "exam-tip",
      text: "If kubectl itself hangs or refuses connections, suspect kube-apiserver's static pod manifest on the control-plane — /etc/kubernetes/manifests/kube-apiserver.yaml.",
    },
    {
      type: "deep-dive",
      text: "kubelet's static pod directory is set by staticPodPath in /var/lib/kubelet/config.yaml — it's /etc/kubernetes/manifests by kubeadm convention, not hardcoded.",
    },
    {
      type: "deep-dive",
      text: "The mirror pod you see in kubectl get pods for a static pod (name suffixed with the node name) is read-only — deleting it via kubectl just recreates it; only the manifest file matters.",
    },
  ],
};

export default lesson;
