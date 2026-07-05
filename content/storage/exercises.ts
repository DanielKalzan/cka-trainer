import type { TerminalExercise } from "@/lib/types/content";
import { emptyClusterState, makeNode, type ClusterState } from "@/lib/terminal-engine/cluster-state";

function baseState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [makeNode("controlplane", { controlPlane: true }), makeNode("node01")];
  return state;
}

// ---------------------------------------------------------------------------
// 1. Static provisioning end-to-end: PV + PVC + pod
// ---------------------------------------------------------------------------

const pvPvcPod: TerminalExercise = {
  id: "st-ex-pv-pvc-pod",
  domainId: "storage",
  title: "Wire a pod to persistent storage",
  scenario: `An app must persist its logs on \`node01\`'s local disk under \`/mnt/logs\`.

**Task:**
1. Create a PersistentVolume \`pv-logs\`: capacity \`1Gi\`, access mode \`ReadWriteOnce\`, storageClassName \`manual\`, hostPath \`/mnt/logs\`.
2. Create a PersistentVolumeClaim \`logs-claim\` in \`default\`: request \`500Mi\`, \`ReadWriteOnce\`, storageClassName \`manual\`.
3. Create a pod \`log-writer\` (image \`busybox:1.36\`) that mounts the claim at \`/var/log/app\`.`,
  initialState: baseState(),
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
  namespace: default
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
  checker: (state) => {
    const pv = state.persistentvolumes.find((p) => p.metadata.name === "pv-logs");
    if (!pv) return { passed: false, feedback: "PersistentVolume pv-logs doesn't exist yet." };
    if (pv.spec.capacity?.storage !== "1Gi") {
      return { passed: false, feedback: `pv-logs capacity is ${pv.spec.capacity?.storage ?? "unset"} — the task wants 1Gi.` };
    }
    if (!pv.spec.accessModes?.includes("ReadWriteOnce")) {
      return { passed: false, feedback: "pv-logs must offer accessMode ReadWriteOnce." };
    }
    if (pv.spec.storageClassName !== "manual") {
      return {
        passed: false,
        feedback: "pv-logs needs storageClassName: manual — without it the claim can never bind (exact-match rule).",
      };
    }
    if (pv.spec.hostPath?.path !== "/mnt/logs") {
      return { passed: false, feedback: "pv-logs must be backed by hostPath /mnt/logs." };
    }

    const pvc = state.persistentvolumeclaims.find(
      (c) => c.metadata.name === "logs-claim" && (c.metadata.namespace ?? "default") === "default",
    );
    if (!pvc) return { passed: false, feedback: "PV ✓ — PVC logs-claim is missing in default." };
    if (pvc.spec.storageClassName !== "manual") {
      return { passed: false, feedback: "logs-claim must set storageClassName: manual to match the PV." };
    }
    if (pvc.spec.resources?.requests?.storage !== "500Mi") {
      return { passed: false, feedback: "logs-claim must request exactly 500Mi." };
    }
    if (!pvc.spec.accessModes?.includes("ReadWriteOnce")) {
      return { passed: false, feedback: "logs-claim must request accessMode ReadWriteOnce." };
    }

    const pod = state.pods.find(
      (p) => p.metadata.name === "log-writer" && (p.metadata.namespace ?? "default") === "default",
    );
    if (!pod) return { passed: false, feedback: "PV and PVC ✓ — pod log-writer is missing." };
    const vol = (pod.spec.volumes ?? []).find(
      (v) => v.persistentVolumeClaim?.claimName === "logs-claim",
    );
    if (!vol) {
      return {
        passed: false,
        feedback:
          "log-writer doesn't reference the claim — volumes[].persistentVolumeClaim.claimName: logs-claim (pods mount claims, never PVs directly).",
      };
    }
    const mount = pod.spec.containers[0]?.volumeMounts?.find(
      (m) => m.name === vol.name && m.mountPath === "/var/log/app",
    );
    if (!mount) {
      return {
        passed: false,
        feedback: "The volume exists but isn't mounted at /var/log/app (volumeMounts name must match the volume's name).",
      };
    }
    return {
      passed: true,
      feedback:
        "Full chain: PV (disk) ← PVC (request) ← pod (mount). The class name matching on both sides is what makes the binding deterministic.",
    };
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
2. Create a PVC \`cache-claim\` in \`default\` requesting \`2Gi\`, \`ReadWriteOnce\`, using that class.

The claim staying \`Pending\` afterwards is expected — no pod consumes it yet.`,
  initialState: baseState(),
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
  namespace: default
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-local
  resources:
    requests:
      storage: 2Gi`,
  ],
  checker: (state) => {
    const sc = state.storageclasses.find((s) => s.metadata.name === "fast-local");
    if (!sc) return { passed: false, feedback: "StorageClass fast-local doesn't exist yet." };
    if (sc.provisioner !== "kubernetes.io/no-provisioner") {
      return {
        passed: false,
        feedback: `fast-local's provisioner is ${sc.provisioner ?? "unset"} — the task wants kubernetes.io/no-provisioner. (Remember: top-level field, no spec:.)`,
      };
    }
    if (sc.volumeBindingMode !== "WaitForFirstConsumer") {
      return { passed: false, feedback: "fast-local must set volumeBindingMode: WaitForFirstConsumer." };
    }
    if (sc.allowVolumeExpansion !== true) {
      return { passed: false, feedback: "fast-local must set allowVolumeExpansion: true." };
    }

    const pvc = state.persistentvolumeclaims.find(
      (c) => c.metadata.name === "cache-claim" && (c.metadata.namespace ?? "default") === "default",
    );
    if (!pvc) return { passed: false, feedback: "StorageClass ✓ — PVC cache-claim is missing in default." };
    if (pvc.spec.storageClassName !== "fast-local") {
      return { passed: false, feedback: "cache-claim must use storageClassName: fast-local." };
    }
    if (pvc.spec.resources?.requests?.storage !== "2Gi") {
      return { passed: false, feedback: "cache-claim must request exactly 2Gi." };
    }
    if (!pvc.spec.accessModes?.includes("ReadWriteOnce")) {
      return { passed: false, feedback: "cache-claim must request accessMode ReadWriteOnce." };
    }
    return {
      passed: true,
      feedback:
        "Class + claim done. The claim will sit Pending until a pod consumes it — with WaitForFirstConsumer that's correct behavior, not a bug.",
    };
  },
  timeBudgetSeconds: 420,
  points: 80,
  difficulty: "medium",
};

const exercises: TerminalExercise[] = [pvPvcPod, storageClassClaim];

export default exercises;
