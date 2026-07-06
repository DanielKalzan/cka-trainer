import type { CheckResult } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";
import { appsApi, autoscalingApi, coreApi, orNotFound } from "./client";

export async function checkRollback(namespace: string): Promise<CheckResult> {
  const dep = await orNotFound(
    appsApi().readNamespacedDeployment({ name: "payments", namespace }),
  );
  if (!dep) {
    return { passed: false, feedback: "Deployment payments is gone — rollback, not removal." };
  }
  const image = dep.spec?.template.spec?.containers[0]?.image;
  if (image === "nginx:1.27-perf") {
    return {
      passed: false,
      feedback:
        "Still on the broken 1.27-perf tag. kubectl rollout undo deployment/payments reverts to the previous revision.",
    };
  }
  if (image !== "nginx:1.26-alpine") {
    return {
      passed: false,
      feedback: `Image is now ${image} — the previous healthy revision ran nginx:1.26-alpine. Use rollout undo rather than setting an image by hand.`,
    };
  }
  if ((dep.status?.readyReplicas ?? 0) < 3) {
    return {
      passed: false,
      feedback:
        "Rolled back, but not all 3 replicas are ready yet — watch kubectl rollout status deployment/payments and re-check.",
    };
  }
  return {
    passed: true,
    feedback:
      "Back on 1.26-alpine with 3/3 ready — and the rollback itself became a new revision in history. That's expected: undo rolls forward to an old template.",
  };
}

export async function checkScaleAutoscale(namespace: string): Promise<CheckResult> {
  const worker = await orNotFound(
    appsApi().readNamespacedDeployment({ name: "worker", namespace }),
  );
  if (!worker) return { passed: false, feedback: "Deployment worker is missing." };
  if (worker.spec?.replicas !== 6) {
    return {
      passed: false,
      feedback: `worker has ${worker.spec?.replicas} replicas — the task wants 6 (kubectl scale).`,
    };
  }
  const hpas = await autoscalingApi().listNamespacedHorizontalPodAutoscaler({ namespace });
  const hpa = hpas.items.find(
    (h) => h.spec?.scaleTargetRef.kind === "Deployment" && h.spec.scaleTargetRef.name === "api",
  );
  if (!hpa) {
    return {
      passed: false,
      feedback: "worker scaled ✓ — but there's no HPA targeting the api Deployment yet (kubectl autoscale).",
    };
  }
  const cpu = (hpa.spec?.metrics ?? []).find((m) => m.resource?.name === "cpu")?.resource?.target
    ?.averageUtilization;
  if (hpa.spec?.minReplicas !== 2 || hpa.spec?.maxReplicas !== 8 || cpu !== 70) {
    return {
      passed: false,
      feedback: `HPA exists but with min=${hpa.spec?.minReplicas}, max=${hpa.spec?.maxReplicas}, cpu=${cpu ?? "unset"}% — the task wants 2 / 8 / 70%.`,
    };
  }
  return {
    passed: true,
    feedback:
      "worker at 6 fixed replicas, api elastic between 2–8 at 70% CPU. (kubectl get hpa shows TARGETS as <unknown> here — this lab cluster has no metrics-server; the object itself is what's graded, and what the exam asks for.)",
  };
}

export async function checkDedicatedNode(namespace: string): Promise<CheckResult> {
  const node = await orNotFound(coreApi().readNode({ name: NODES.worker2 }));
  if (!node) return { passed: false, feedback: `${NODES.worker2} is missing.` };
  const taint = (node.spec?.taints ?? []).find(
    (t) => t.key === "dedicated" && t.value === "cache" && t.effect === "NoSchedule",
  );
  if (!taint) {
    return {
      passed: false,
      feedback: `${NODES.worker2} lacks the dedicated=cache:NoSchedule taint (kubectl taint node ...).`,
    };
  }
  if (node.metadata?.labels?.role !== "cache") {
    return { passed: false, feedback: `Taint ✓ — but ${NODES.worker2} still needs the label role=cache.` };
  }
  const pod = await orNotFound(coreApi().readNamespacedPod({ name: "cache-1", namespace }));
  if (!pod) return { passed: false, feedback: "Node prepared ✓ — pod cache-1 doesn't exist yet." };
  if (pod.spec?.containers[0]?.image !== "redis:7.4-alpine") {
    return {
      passed: false,
      feedback: `cache-1 runs ${pod.spec?.containers[0]?.image} — the task wants redis:7.4-alpine.`,
    };
  }
  if (pod.spec?.nodeSelector?.role !== "cache") {
    return {
      passed: false,
      feedback: `cache-1 has no nodeSelector role=cache — tolerating the taint alone doesn't STEER the pod to ${NODES.worker2}.`,
    };
  }
  const tolerated = (pod.spec?.tolerations ?? []).some(
    (t) =>
      t.key === "dedicated" &&
      (t.operator === "Exists" || t.value === "cache") &&
      (!t.effect || t.effect === "NoSchedule"),
  );
  if (!tolerated) {
    return {
      passed: false,
      feedback:
        "cache-1 doesn't tolerate dedicated=cache:NoSchedule — without the toleration the nodeSelector points at a node it may not enter.",
    };
  }
  if (pod.spec?.nodeName !== NODES.worker2) {
    return {
      passed: false,
      feedback: `cache-1's spec looks right but it hasn't been scheduled onto ${NODES.worker2} yet (currently: ${pod.spec?.nodeName ?? "unscheduled"}). Give the scheduler a moment and re-check; if it stays Pending, describe the pod.`,
    };
  }
  return {
    passed: true,
    feedback: `Taint repels everyone else, toleration + nodeSelector pull cache-1 in — it's really running on ${NODES.worker2}. This trio appears on the exam verbatim.`,
  };
}

export async function checkAffinityPending(namespace: string): Promise<CheckResult> {
  const dep = await orNotFound(appsApi().readNamespacedDeployment({ name: "indexer", namespace }));
  if (!dep) {
    return { passed: false, feedback: "Deployment indexer is gone — the task was to unblock it, not remove it." };
  }
  const affinity = dep.spec?.template.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution;
  if (!affinity) {
    return {
      passed: false,
      feedback:
        "The task says don't touch the Deployment's affinity rule — put it back and fix the node side instead.",
    };
  }
  const nodes = await coreApi().listNode();
  const hasSsdNode = nodes.items.some((n) => n.metadata?.labels?.disktype === "ssd");
  if (!hasSsdNode) {
    return {
      passed: false,
      feedback:
        "No node carries disktype=ssd yet — that's exactly what indexer's nodeAffinity requires (kubectl get nodes --show-labels).",
    };
  }
  if ((dep.status?.readyReplicas ?? 0) < 2) {
    return {
      passed: false,
      feedback:
        "Node labeled ✓ — but not both replicas are Ready yet. The scheduler retries Pending pods on its own; give it a moment and re-check.",
    };
  }
  return {
    passed: true,
    feedback:
      "A node now satisfies indexer's nodeAffinity and both replicas are Running — labeling the node (not touching the workload) is the real-exam pattern here.",
  };
}
