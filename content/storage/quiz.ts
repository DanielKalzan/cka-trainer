import type { QuizQuestion } from "@/lib/types/content";

const quiz: QuizQuestion[] = [
  {
    id: "st-q-pvc-pending",
    domainId: "storage",
    type: "multiple-choice",
    prompt:
      "A PVC requests 500Mi, ReadWriteOnce, storageClassName `manual`. An Available PV offers 1Gi, ReadWriteOnce — but no storageClassName. Result?",
    options: [
      "PVC stays Pending — storageClassName must match exactly",
      "They bind — 1Gi covers 500Mi",
      "They bind, but only 500Mi of the PV is usable",
      "The PV is resized down to 500Mi and binds",
    ],
    correctAnswer: "PVC stays Pending — storageClassName must match exactly",
    explanation:
      "Class matching is exact: 'manual' ≠ unset. Capacity and access modes were fine — and had it bound, the claim would own the full 1Gi (binding is 1:1, never partial).",
  },
  {
    id: "st-q-rwo-meaning",
    domainId: "storage",
    type: "multiple-choice",
    prompt: "ReadWriteOnce (RWO) precisely means:",
    options: [
      "Read-write mountable by a single NODE at a time",
      "Read-write mountable by a single POD at a time",
      "Writable once, read-only afterwards",
      "One writer, unlimited readers",
    ],
    correctAnswer: "Read-write mountable by a single NODE at a time",
    explanation:
      "Access modes are per-node: two pods on the SAME node can share an RWO volume. Single-pod exclusivity is what ReadWriteOncePod (RWOP) was added for.",
  },
  {
    id: "st-q-released-pv",
    domainId: "storage",
    type: "multiple-choice",
    prompt:
      "A PVC is deleted. Its PV (reclaimPolicy Retain) shows `Released`. A new identical PVC is created. What happens?",
    options: [
      "Nothing — a Released PV won't rebind until an admin clears it",
      "It binds the Released PV automatically",
      "The PV switches back to Available after a grace period",
      "The new PVC deletes the old data and binds",
    ],
    correctAnswer: "Nothing — a Released PV won't rebind until an admin clears it",
    explanation:
      "Retain keeps the data AND the old claimRef; the PV never returns to Available on its own. Manual step required: delete/recreate the PV, or edit away spec.claimRef.",
  },
  {
    id: "st-q-wffc",
    domainId: "storage",
    type: "multiple-choice",
    prompt:
      "A PVC using a StorageClass with `volumeBindingMode: WaitForFirstConsumer` sits in Pending. No pod references it. What's wrong?",
    options: [
      "Nothing — binding is deferred until a pod uses the claim",
      "The provisioner is down",
      "The PVC needs an explicit volumeName",
      "The class is missing allowVolumeExpansion",
    ],
    correctAnswer: "Nothing — binding is deferred until a pod uses the claim",
    explanation:
      "WaitForFirstConsumer delays provisioning/binding so the volume is created where the pod schedules. Pending-without-a-pod is the designed behavior — a favorite exam decoy symptom.",
  },
  {
    id: "st-q-pod-pvc",
    domainId: "storage",
    type: "yaml-fix",
    prompt: `This pod should use PVC \`logs-claim\`, but the volume definition is wrong. Which key is misused?

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: nginx:1.27
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  volumes:
  - name: logs
    hostPath:
      claimName: logs-claim
\`\`\``,
    correctAnswer: "persistentVolumeClaim",
    acceptableAnswers: [
      "persistentVolumeClaim",
      "hostPath should be persistentVolumeClaim",
      "use persistentVolumeClaim instead of hostPath",
      "persistentVolumeClaim: claimName",
    ],
    explanation:
      "claimName lives under persistentVolumeClaim, not hostPath: volumes[].persistentVolumeClaim.claimName: logs-claim. hostPath mounts a node directory and takes path:, not claimName.",
  },
  {
    id: "st-q-reclaim-delete-default",
    domainId: "storage",
    type: "multiple-choice",
    prompt:
      "A PVC using a dynamically-provisioned StorageClass (no reclaimPolicy set explicitly) is deleted. What happens to the PV and underlying storage?",
    options: [
      "Both the PV object and the underlying storage volume are deleted — Delete is the default reclaimPolicy",
      "The PV becomes Released but the data and PV object are kept, waiting for an admin",
      "Nothing happens until you also delete the StorageClass",
      "The PV is recycled and scrubbed for reuse (Recycle is the default)",
    ],
    correctAnswer: "Both the PV object and the underlying storage volume are deleted — Delete is the default reclaimPolicy",
    explanation:
      "Delete is the default reclaimPolicy for dynamically-provisioned volumes — deleting the PVC triggers deletion of both the PV object and the backing storage. Retain (data + PV object kept) must be set explicitly; Recycle is deprecated.",
  },
  {
    id: "st-q-allow-volume-expansion",
    domainId: "storage",
    type: "command-fill",
    prompt:
      "Which single field, set on a StorageClass, must be `true` before a PVC using that class can be resized larger?",
    correctAnswer: "allowVolumeExpansion",
    acceptableAnswers: ["allowVolumeExpansion", "allowVolumeExpansion: true"],
    explanation:
      "Without allowVolumeExpansion: true on the StorageClass, editing a PVC's spec.resources.requests.storage to a larger value is rejected. Expansion only ever grows a volume — you can't shrink one this way.",
  },
  {
    id: "st-q-emptydir-lifecycle",
    domainId: "storage",
    type: "multiple-choice",
    prompt:
      "A pod has an `emptyDir` volume. A container inside it crashes and is restarted by kubelet. What happens to the emptyDir's contents?",
    options: [
      "They survive — emptyDir is tied to the Pod's lifetime, not any single container's",
      "They're wiped — emptyDir resets on every container restart",
      "They move to the next node the pod is rescheduled to",
      "They persist even after the whole Pod is deleted",
    ],
    correctAnswer: "They survive — emptyDir is tied to the Pod's lifetime, not any single container's",
    explanation:
      "emptyDir's contents survive individual container crashes/restarts within the same Pod. They're only wiped when the POD itself is removed from the node — and they never survive a reschedule to a different node, since the storage is node-local.",
  },
  {
    id: "st-q-emptydir-memory",
    domainId: "storage",
    type: "command-fill",
    prompt: "Which `emptyDir.medium` value backs the volume with tmpfs (RAM) instead of the node's disk?",
    correctAnswer: "Memory",
    acceptableAnswers: ["Memory", "medium: Memory"],
    explanation:
      "medium: Memory mounts the emptyDir as tmpfs — fast, but it counts against the pod's memory usage and vanishes completely if the pod is deleted or the node reboots (it was never on disk).",
  },
  {
    id: "st-q-rox-meaning",
    domainId: "storage",
    type: "multiple-choice",
    prompt: "ReadOnlyMany (ROX) precisely means:",
    options: [
      "Mountable read-only by many nodes simultaneously",
      "Mountable read-only by a single pod, read-write by others",
      "One writer node, unlimited read-only pods on that same node",
      "Read-write until the first mount, then locked read-only",
    ],
    correctAnswer: "Mountable read-only by many nodes simultaneously",
    explanation:
      "Like RWO/RWX, ROX is a per-NODE access mode — many nodes (and any number of pods on each) can mount the volume read-only at once. It says nothing about write access, which requires RWO or RWX instead.",
  },
  {
    id: "st-q-default-storageclass",
    domainId: "storage",
    type: "command-fill",
    prompt:
      "A PVC omits `storageClassName` entirely. Which annotation on a StorageClass marks it as the one that gets used automatically?",
    correctAnswer: "storageclass.kubernetes.io/is-default-class",
    acceptableAnswers: [
      "storageclass.kubernetes.io/is-default-class",
      'storageclass.kubernetes.io/is-default-class: "true"',
    ],
    explanation:
      'Omitting storageClassName doesn\'t mean "no class" — it means "whichever StorageClass is annotated storageclass.kubernetes.io/is-default-class: \'true\'". If no class carries that annotation, the PVC stays unbound instead.',
  },
  {
    id: "st-q-accessmode-mismatch",
    domainId: "storage",
    type: "yaml-fix",
    prompt: `The PVC stays Pending and never binds to pv-logs, even though 10Gi easily covers the 5Gi request. Why?

\`\`\`yaml
# PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-logs
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
---
# candidate PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-logs
spec:
  capacity:
    storage: 10Gi
  accessModes:
  - ReadWriteOnce
  hostPath:
    path: /data/logs
\`\`\``,
    correctAnswer: "The PV only lists ReadWriteOnce — it doesn't support ReadWriteMany, which the PVC requires",
    acceptableAnswers: [
      "PV doesn't offer ReadWriteMany",
      "accessModes mismatch: PV is RWO, PVC wants RWX",
      "add ReadWriteMany to the PV's accessModes",
    ],
    explanation:
      "A PVC only binds to a PV whose accessModes include everything the PVC requests. Capacity being sufficient doesn't matter if the access mode itself isn't offered — a PV must list ReadWriteMany for an RWX claim to ever bind to it.",
  },
];

export default quiz;
