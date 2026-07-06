import type { CheckResult } from "@/lib/types/content";
import { NODES } from "@/lib/constants/cluster";
import { appsApi, coreApi, orNotFound, readyEndpointCount } from "./client";

export async function checkImagePull(namespace: string): Promise<CheckResult> {
  const dep = await orNotFound(appsApi().readNamespacedDeployment({ name: "web", namespace }));
  if (!dep) {
    return { passed: false, feedback: "Deployment web is gone. Fix the image, don't delete the workload." };
  }
  const image = dep.spec?.template.spec?.containers[0]?.image;
  if (image === "nginx:1.27-alpin") {
    return {
      passed: false,
      feedback:
        "The Deployment still points at nginx:1.27-alpin (the broken tag). describe a pod and read its events.",
    };
  }
  if (image !== "nginx:1.27-alpine") {
    return {
      passed: false,
      feedback: `Image changed to ${image}, but the task asked for nginx:1.27-alpine exactly.`,
    };
  }
  if ((dep.status?.readyReplicas ?? 0) < 2) {
    return {
      passed: false,
      feedback:
        "Image fixed on the Deployment, but not all 2 replicas are ready yet — the pull may still be in flight; watch kubectl get pods and re-check.",
    };
  }
  return {
    passed: true,
    feedback:
      "Both replicas Running on the corrected tag. Fixing the Deployment (not the pods) is the pattern — controllers always win.",
  };
}

export async function checkCrashLoop(namespace: string): Promise<CheckResult> {
  const dep = await orNotFound(appsApi().readNamespacedDeployment({ name: "api", namespace }));
  if (!dep) {
    return { passed: false, feedback: "Deployment api is gone — the task was to fix it, not remove it." };
  }
  const env = dep.spec?.template.spec?.containers[0]?.env ?? [];
  const dbHost = env.find((e) => e.name === "DB_HOST");
  if (!dbHost?.value) {
    return {
      passed: false,
      feedback:
        "The Deployment's container still has no DB_HOST env var. kubectl logs on the pod says exactly what it wants.",
    };
  }
  if ((dep.status?.readyReplicas ?? 0) < 1) {
    return {
      passed: false,
      feedback:
        "DB_HOST is set but the pod isn't ready yet — the old pod may still be in its crash backoff; watch kubectl get pods and re-check.",
    };
  }
  return {
    passed: true,
    feedback:
      "Crash loop broken: logs → missing env var → edit the Deployment. That read-the-logs-first reflex is worth a lot of exam points.",
  };
}

export async function checkSvcSelector(namespace: string): Promise<CheckResult> {
  const svc = await orNotFound(
    coreApi().readNamespacedService({ name: "catalog-svc", namespace }),
  );
  if (!svc) return { passed: false, feedback: "Service catalog-svc is gone." };
  if (svc.spec?.selector?.app !== "catalog") {
    return {
      passed: false,
      feedback:
        "catalog-svc still doesn't select the running pods. Its selector must match the pods' labels exactly (app=catalog).",
    };
  }
  const port = svc.spec?.ports?.[0];
  const targetPort = typeof port?.targetPort === "number" ? port.targetPort : Number(port?.targetPort);
  if (!port || port.port !== 80 || targetPort !== 8080) {
    return {
      passed: false,
      feedback:
        "Selector is fixed, but keep the ports as they were: port 80 → targetPort 8080 (the container listens on 8080).",
    };
  }
  const relabeled = await coreApi().listNamespacedPod({ namespace, labelSelector: "app=catalogue" });
  if (relabeled.items.length > 0) {
    return {
      passed: false,
      feedback: "The task said the pods are correct — fix the Service selector, not the pod labels.",
    };
  }
  const endpoints = await readyEndpointCount(namespace, "catalog-svc");
  if (endpoints < 1) {
    return {
      passed: false,
      feedback:
        "Selector fixed but no endpoints have shown up yet — give the endpoint controller a moment and re-check (kubectl describe svc catalog-svc).",
    };
  }
  return {
    passed: true,
    feedback: `Selector matches, ${endpoints} endpoint(s) populated, traffic flows. Selector↔label mismatch is the #1 cause of 'service is down' tasks.`,
  };
}

export async function checkTaintPending(namespace: string): Promise<CheckResult> {
  const node = await orNotFound(coreApi().readNode({ name: NODES.worker }));
  if (!node) {
    return { passed: false, feedback: `${NODES.worker} is missing — removing the node was not the task.` };
  }
  const stillTainted = (node.spec?.taints ?? []).some((t) => t.key === "maintenance");
  if (stillTainted) {
    return {
      passed: false,
      feedback: `${NODES.worker} still carries the maintenance taint. The FailedScheduling event in describe pod names it exactly.`,
    };
  }
  const dep = await orNotFound(appsApi().readNamespacedDeployment({ name: "queue", namespace }));
  if (!dep) {
    return { passed: false, feedback: "Deployment queue is gone — the task was to unblock it, not remove it." };
  }
  if (dep.spec?.template.spec?.tolerations?.length) {
    return {
      passed: false,
      feedback: "The task said not to modify the Deployment (no tolerations workaround) — remove them and fix the node instead.",
    };
  }
  if ((dep.status?.readyReplicas ?? 0) < 2) {
    return {
      passed: false,
      feedback:
        "Taint removed ✓ — the scheduler retries Pending pods on its own, but they may still be starting (or pulling the image). Watch kubectl get pods and re-check.",
    };
  }
  return {
    passed: true,
    feedback:
      "Taint gone, and the scheduler placed the Pending pods by itself — no pod deletion needed. taint <node> <key>- to remove is worth having in muscle memory.",
  };
}
