import type { Lesson } from "@/lib/types/content";

const lesson: Lesson = {
  id: "st-pv-pvc-lifecycle",
  domainId: "storage",
  title: "PV ↔ PVC binding: why claims stay Pending",
  estMinutes: 10,
  body: `
Three objects, one chain: **PV** (the disk, cluster-scoped) ← binds → **PVC** (the request, namespaced) ← mounts → **Pod**.

\`\`\`yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-logs
spec:
  capacity: { storage: 1Gi }
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  hostPath: { path: /mnt/logs }
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-claim
  namespace: default
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources:
    requests: { storage: 500Mi }
\`\`\`

Pod side:

\`\`\`yaml
volumes:
- name: logs
  persistentVolumeClaim: { claimName: logs-claim }
containers:
- volumeMounts:
  - name: logs
    mountPath: /var/log/app
\`\`\`

## Binding rules — the exam checklist

A PVC binds a PV only when **all** hold:

1. \`storageClassName\` matches **exactly** (empty string and unset are different things — the classic gotcha).
2. PV capacity ≥ PVC request. (A 500Mi claim happily binds a 1Gi PV — and consumes all of it; binding is 1:1, no sharing, no splitting.)
3. PV's accessModes ⊇ the PVC's.
4. PV is \`Available\` — a \`Released\` PV does NOT rebind on its own.

A Pending PVC means one of those four. \`kubectl describe pvc\` says which.

## Access modes (per-NODE, not per-pod)

- \`ReadWriteOnce\` (RWO) — one **node** read-write; multiple pods on that node still share it.
- \`ReadOnlyMany\` / \`ReadWriteMany\` (ROX/RWX) — many nodes; RWX needs NFS-like storage.
- \`ReadWriteOncePod\` (RWOP) — strictly one pod.

## Reclaim policy — what happens after the claim dies

- \`Retain\` — data kept; PV goes \`Released\` and needs manual cleanup (delete + recreate the PV) before anyone rebinds it.
- \`Delete\` — PV and backing storage removed with the claim (dynamic provisioning default).

\`kubectl get pv\` shows STATUS and RECLAIM POLICY side by side — read both when a "reuse this volume" task appears.
`,
  tips: [
    {
      type: "exam-tip",
      text: "PVC Pending forever? Check storageClassName equality FIRST — a PV with class 'manual' will never bind a PVC that omits the field. describe pvc names the mismatch.",
    },
    {
      type: "exam-tip",
      text: "PVs are cluster-scoped, PVCs namespaced. The pod and its PVC must share a namespace; the PV doesn't care.",
    },
    {
      type: "deep-dive",
      text: "A Released PV keeps the old claimRef — that's what blocks rebinding under Retain. Clearing spec.claimRef by hand (kubectl edit pv) returns it to Available without destroying data; ugly but legal.",
    },
    {
      type: "deep-dive",
      text: "hostPath PVs pin data to one node — fine for exam single-node scenarios, wrong answer for anything multi-node. local PVs with nodeAffinity are the production-shaped variant.",
    },
  ],
};

export default lesson;
