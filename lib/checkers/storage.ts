import type { CheckResult } from "@/lib/types/content";
import { coreApi, storageApi, orNotFound } from "./client";

/**
 * Storage-domain checkers. Grade the real cluster in the session namespace —
 * multiple solution paths (apply, create, edit) all converge on the same state.
 */

export async function checkPvPvcPod(namespace: string): Promise<CheckResult> {
  const core = coreApi();

  const pv = await orNotFound(core.readPersistentVolume({ name: "pv-logs" }));
  if (!pv) return { passed: false, feedback: "PersistentVolume pv-logs doesn't exist yet." };
  if (pv.spec?.capacity?.storage !== "1Gi") {
    return {
      passed: false,
      feedback: `pv-logs capacity is ${pv.spec?.capacity?.storage ?? "unset"} — the task wants 1Gi.`,
    };
  }
  if (!pv.spec?.accessModes?.includes("ReadWriteOnce")) {
    return { passed: false, feedback: "pv-logs must offer accessMode ReadWriteOnce." };
  }
  if (pv.spec?.storageClassName !== "manual") {
    return {
      passed: false,
      feedback:
        "pv-logs needs storageClassName: manual — without it the claim can never bind (exact-match rule).",
    };
  }
  if (pv.spec?.hostPath?.path !== "/mnt/logs") {
    return { passed: false, feedback: "pv-logs must be backed by hostPath /mnt/logs." };
  }

  const pvc = await orNotFound(
    core.readNamespacedPersistentVolumeClaim({ name: "logs-claim", namespace }),
  );
  if (!pvc) {
    return {
      passed: false,
      feedback: `PV ✓ — PVC logs-claim is missing in ${namespace} (the terminal's default namespace; just omit -n).`,
    };
  }
  if (pvc.spec?.storageClassName !== "manual") {
    return { passed: false, feedback: "logs-claim must set storageClassName: manual to match the PV." };
  }
  if (pvc.spec?.resources?.requests?.storage !== "500Mi") {
    return { passed: false, feedback: "logs-claim must request exactly 500Mi." };
  }
  if (!pvc.spec?.accessModes?.includes("ReadWriteOnce")) {
    return { passed: false, feedback: "logs-claim must request accessMode ReadWriteOnce." };
  }
  if (pvc.status?.phase !== "Bound") {
    return {
      passed: false,
      feedback:
        "logs-claim's spec looks right but it isn't Bound yet. Binding takes a moment — re-check; if it stays Pending, compare class name, capacity, and access modes against the PV.",
    };
  }

  const pod = await orNotFound(core.readNamespacedPod({ name: "log-writer", namespace }));
  if (!pod) return { passed: false, feedback: "PV and PVC ✓ — pod log-writer is missing." };
  const vol = (pod.spec?.volumes ?? []).find(
    (v) => v.persistentVolumeClaim?.claimName === "logs-claim",
  );
  if (!vol) {
    return {
      passed: false,
      feedback:
        "log-writer doesn't reference the claim — volumes[].persistentVolumeClaim.claimName: logs-claim (pods mount claims, never PVs directly).",
    };
  }
  const mounted = (pod.spec?.containers ?? []).some((c) =>
    (c.volumeMounts ?? []).some((m) => m.name === vol.name && m.mountPath === "/var/log/app"),
  );
  if (!mounted) {
    return {
      passed: false,
      feedback:
        "The volume exists but isn't mounted at /var/log/app (volumeMounts name must match the volume's name).",
    };
  }
  return {
    passed: true,
    feedback:
      "Full chain: PV (disk) ← PVC (request, really Bound) ← pod (mount). The class name matching on both sides is what makes the binding deterministic.",
  };
}

export async function checkStorageClassClaim(namespace: string): Promise<CheckResult> {
  const sc = await orNotFound(storageApi().readStorageClass({ name: "fast-local" }));
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

  const pvc = await orNotFound(
    coreApi().readNamespacedPersistentVolumeClaim({ name: "cache-claim", namespace }),
  );
  if (!pvc) {
    return {
      passed: false,
      feedback: `StorageClass ✓ — PVC cache-claim is missing in ${namespace} (the terminal's default namespace; just omit -n).`,
    };
  }
  if (pvc.spec?.storageClassName !== "fast-local") {
    return { passed: false, feedback: "cache-claim must use storageClassName: fast-local." };
  }
  if (pvc.spec?.resources?.requests?.storage !== "2Gi") {
    return { passed: false, feedback: "cache-claim must request exactly 2Gi." };
  }
  if (!pvc.spec?.accessModes?.includes("ReadWriteOnce")) {
    return { passed: false, feedback: "cache-claim must request accessMode ReadWriteOnce." };
  }
  // Deliberately NOT requiring Bound: with WaitForFirstConsumer and no pod,
  // Pending is the correct end state.
  return {
    passed: true,
    feedback:
      "Class + claim done. The claim sits Pending until a pod consumes it — with WaitForFirstConsumer that's correct behavior, not a bug (you can see it live: kubectl get pvc).",
  };
}
