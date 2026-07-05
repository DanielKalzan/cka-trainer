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
];

export default quiz;
