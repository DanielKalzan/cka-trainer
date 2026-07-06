import type { TerminalExercise } from "@/lib/types/content";

// ---------------------------------------------------------------------------
// 1. Static provisioning end-to-end: PV + PVC + pod
// ---------------------------------------------------------------------------

const pvPvcPod: TerminalExercise = {
  id: "st-ex-pv-pvc-pod",
  domainId: "storage",
  title: "Wire a pod to persistent storage",
  scenario: `An app must persist its logs on a node's local disk under \`/mnt/logs\`.

**Task:**
1. Create a PersistentVolume \`pv-logs\`: capacity \`1Gi\`, access mode \`ReadWriteOnce\`, storageClassName \`manual\`, hostPath \`/mnt/logs\`.
2. Create a PersistentVolumeClaim \`logs-claim\`: request \`500Mi\`, \`ReadWriteOnce\`, storageClassName \`manual\`.
3. Create a pod \`log-writer\` (image \`busybox:1.36\`) that mounts the claim at \`/var/log/app\`.

(Work in the terminal's default namespace — no \`-n\` needed.)`,
  hints: [
    "All three are YAML (kubectl apply -f - and paste; separate docs with ---). PVs have no imperative create.",
    "Binding checklist: storageClassName identical on PV and PVC, PV capacity ≥ request, access modes compatible. The pod references the CLAIM (persistentVolumeClaim.claimName), never the PV.",
    `Full solution (kubectl apply -f -, then paste):
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-logs
spec:
  capacity:
    storage: 1Gi
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  hostPath:
    path: /mnt/logs
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-claim
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources:
    requests:
      storage: 500Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: log-writer
spec:
  containers:
  - name: log-writer
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  volumes:
  - name: logs
    persistentVolumeClaim:
      claimName: logs-claim`,
  ],
  live: {
    clusterScopedCleanup: [{ kind: "PersistentVolume", name: "pv-logs" }],
  },
  timeBudgetSeconds: 540,
  points: 100,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 2. StorageClass + claim
// ---------------------------------------------------------------------------

const storageClassClaim: TerminalExercise = {
  id: "st-ex-storageclass",
  domainId: "storage",
  title: "A StorageClass for local volumes",
  scenario: `The team standardizes on delayed-binding local storage.

**Task:**
1. Create a StorageClass \`fast-local\`: provisioner \`kubernetes.io/no-provisioner\`, volumeBindingMode \`WaitForFirstConsumer\`, allowVolumeExpansion \`true\`.
2. Create a PVC \`cache-claim\` requesting \`2Gi\`, \`ReadWriteOnce\`, using that class.

The claim staying \`Pending\` afterwards is expected — no pod consumes it yet.`,
  hints: [
    "Both objects are YAML via kubectl apply -f -. StorageClass fields (provisioner, volumeBindingMode, allowVolumeExpansion) are TOP-LEVEL — there is no spec: block.",
    "apiVersion for StorageClass is storage.k8s.io/v1. The PVC references the class by name in spec.storageClassName.",
    `Full solution (kubectl apply -f -, then paste):
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-local
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cache-claim
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-local
  resources:
    requests:
      storage: 2Gi`,
  ],
  live: {
    clusterScopedCleanup: [{ kind: "StorageClass", name: "fast-local" }],
  },
  timeBudgetSeconds: 420,
  points: 80,
  difficulty: "medium",
};

// ---------------------------------------------------------------------------
// 3. PVC stuck Pending from a StorageClass name mismatch
// ---------------------------------------------------------------------------

const pvcMismatch: TerminalExercise = {
  id: "st-ex-pvc-mismatch",
  domainId: "storage",
  title: "cache-pvc has sat Pending since it was created",
  scenario: `\`cache-pvc\` has sat \`Pending\` since it was created. A StorageClass \`local\` and a matching PersistentVolume \`pv-cache\` both already exist and should satisfy it.

**Task:** Find the mismatch and fix the PVC so it binds. Don't touch the StorageClass or the PV.`,
  hints: [
    "kubectl describe pvc cache-pvc — compare its storageClassName against kubectl get storageclass, character-for-character.",
    "storageClassName is immutable once a PVC is created — kubectl edit won't let you change it. Delete cache-pvc and recreate it with the correct value.",
    `Full solution:
kubectl delete pvc cache-pvc
kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cache-pvc
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: local
  resources:
    requests:
      storage: 500Mi`,
  ],
  live: {
    manifest: "content/storage/manifests/pvc-mismatch.yaml",
    clusterScopedCleanup: [
      { kind: "StorageClass", name: "local" },
      { kind: "PersistentVolume", name: "pv-cache" },
    ],
  },
  timeBudgetSeconds: 360,
  points: 90,
  difficulty: "medium",
};

const exercises: TerminalExercise[] = [pvPvcPod, storageClassClaim, pvcMismatch];

export default exercises;
