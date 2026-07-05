import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "ca-etcd-backup-restore",
  domainId: "cluster-architecture",
  title: "etcd backup & restore, cold",
  estMinutes: 12,
  body: `
This is the single most predictable task on the exam — it shows up in some form almost every time, and it's pure muscle memory. You must be able to type both commands without looking anything up.

## The backup command

\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot save /opt/backup/etcd.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
\`\`\`

The three TLS flags are what people forget under pressure. Don't memorize them as abstract flags — memorize the *directory*: everything lives in \`/etc/kubernetes/pki/etcd/\`. If you can't remember the exact filenames, look at the etcd static pod manifest:

\`\`\`bash
grep -E "cert|key|trusted" /etc/kubernetes/manifests/etcd.yaml
\`\`\`

The manifest's \`--cert-file\`, \`--key-file\` and \`--trusted-ca-file\` flags give you the exact paths to reuse.

## The restore procedure

Restore is a three-step dance, and step 1 is the only \`etcdctl\` part:

\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot restore /opt/backup/etcd.db \\
  --data-dir=/var/lib/etcd-restored
\`\`\`

**Restore writes to a NEW data directory.** It does not touch the running etcd. Then:

1. Edit \`/etc/kubernetes/manifests/etcd.yaml\`
2. Change the \`hostPath\` volume named \`etcd-data\` from \`/var/lib/etcd\` to \`/var/lib/etcd-restored\`
3. Wait — kubelet notices the static pod manifest changed and recreates etcd. Give it a minute, then \`kubectl get pods -n kube-system\` to confirm.

No certs needed on restore of a local snapshot file — it's just unpacking a file to disk. If the graders' task says "restore to /var/lib/etcd-from-backup", use exactly that path in both the restore command and the manifest.

## Verifying a snapshot

\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot status /opt/backup/etcd.db --write-out=table
\`\`\`

Rarely asked, cheap to know.
`,
  tips: [
    {
      type: "exam-tip",
      text: "Memorize cold: snapshot save needs --endpoints + 3 TLS flags from /etc/kubernetes/pki/etcd/; snapshot restore needs only --data-dir pointing at a NEW directory.",
    },
    {
      type: "exam-tip",
      text: "Fastest cert-path recall: cat /etc/kubernetes/manifests/etcd.yaml and reuse the --cert-file/--key-file/--trusted-ca-file paths it already contains.",
    },
    {
      type: "exam-tip",
      text: "After editing the static pod manifest, the etcd pod restarts on its own — do NOT kubectl delete it. If it seems stuck, check kubelet picked up the change: crictl ps | grep etcd.",
    },
    {
      type: "deep-dive",
      text: "ETCDCTL_API=3 is the default in etcdctl ≥ 3.4, so modern exam environments don't strictly need it — but typing it costs 2 seconds and guards against an old binary. etcdutl is the newer offline tool that upstream recommends for restore; etcdctl still works and is what the exam expects.",
    },
    {
      type: "deep-dive",
      text: "Restore rewrites cluster membership metadata (new cluster ID). That's why production multi-member restores need --initial-cluster flags — single-node kubeadm clusters on the exam don't.",
    },
  ],
};

export default lesson;
