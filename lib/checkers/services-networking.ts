import type { CheckResult } from "@/lib/types/content";
import { coreApi, networkingApi, orNotFound, readyEndpointCount } from "./client";

const portNum = (p: number | string | undefined): number | undefined =>
  p === undefined ? undefined : typeof p === "number" ? p : parseInt(p, 10);

export async function checkExpose(namespace: string): Promise<CheckResult> {
  const svc = await orNotFound(
    coreApi().readNamespacedService({ name: "frontend-svc", namespace }),
  );
  if (!svc) return { passed: false, feedback: "No Service named frontend-svc yet." };
  if (svc.spec?.type && svc.spec.type !== "ClusterIP") {
    return { passed: false, feedback: `frontend-svc is type ${svc.spec.type}; the task asked for ClusterIP.` };
  }
  if (svc.spec?.selector?.app !== "frontend") {
    return {
      passed: false,
      feedback:
        "frontend-svc doesn't select the frontend pods (needs selector app=frontend). kubectl expose gets this right automatically.",
    };
  }
  const p = svc.spec?.ports?.[0];
  if (!p || p.port !== 80) {
    return { passed: false, feedback: "The Service must listen on port 80." };
  }
  if (portNum(p.targetPort) !== 8080) {
    return {
      passed: false,
      feedback:
        "targetPort must be 8080 — without --target-port it defaults to the service port (80), where nothing listens.",
    };
  }
  const endpoints = await readyEndpointCount(namespace, "frontend-svc");
  if (endpoints < 1) {
    return {
      passed: false,
      feedback:
        "Spec looks right but the Service has no ready endpoints yet — the pods may still be starting; re-check in a moment (kubectl get endpointslices).",
    };
  }
  return {
    passed: true,
    feedback: `Service up: 80 → 8080, selector matching, ${endpoints} live endpoint(s) behind it — checking endpoints is always your final verification.`,
  };
}

export async function checkNodePort(namespace: string): Promise<CheckResult> {
  const svc = await orNotFound(coreApi().readNamespacedService({ name: "hits-svc", namespace }));
  if (!svc) return { passed: false, feedback: "No Service named hits-svc yet." };
  if (svc.spec?.type !== "NodePort") {
    return { passed: false, feedback: `hits-svc is ${svc.spec?.type ?? "ClusterIP"} — it must be NodePort.` };
  }
  if (svc.spec?.selector?.app !== "hits") {
    return { passed: false, feedback: "hits-svc doesn't select the hits pods (selector app=hits)." };
  }
  const p = svc.spec?.ports?.[0];
  if (!p || p.port !== 80 || portNum(p.targetPort) !== 3000) {
    return { passed: false, feedback: "Ports must be: port 80 → targetPort 3000." };
  }
  if (p.nodePort !== 30080) {
    return {
      passed: false,
      feedback: `nodePort is ${p.nodePort ?? "unset"} — the task pins it to 30080. Edit the Service and set spec.ports[0].nodePort.`,
    };
  }
  return {
    passed: true,
    feedback:
      "nodeIP:30080 → :80 → :3000. Pinning nodePort via edit is the reliable route; remember the 30000–32767 range constraint.",
  };
}

interface NetpolPeer {
  podSelector?: { matchLabels?: Record<string, string> };
  namespaceSelector?: { matchLabels?: Record<string, string> };
}

export async function checkNetpol(namespace: string): Promise<CheckResult> {
  const np = await orNotFound(
    networkingApi().readNamespacedNetworkPolicy({ name: "allow-web-to-db", namespace }),
  );
  if (!np) {
    return {
      passed: false,
      feedback: "No NetworkPolicy named allow-web-to-db yet. Write the YAML and apply -f -.",
    };
  }
  if (np.spec?.podSelector?.matchLabels?.app !== "db") {
    return {
      passed: false,
      feedback:
        "spec.podSelector must select the pods being PROTECTED — the db pods (app=db). The web selector belongs under ingress.from.",
    };
  }
  if (np.spec?.policyTypes && !np.spec.policyTypes.includes("Ingress")) {
    return {
      passed: false,
      feedback: "policyTypes must include Ingress for this policy to restrict incoming traffic.",
    };
  }
  // client-node's codegen renames the YAML `from` field to `_from`.
  const rules = np.spec?.ingress ?? [];
  const rule = rules.find((r) =>
    ((r._from ?? []) as NetpolPeer[]).some((f) => f.podSelector?.matchLabels?.app === "web"),
  );
  if (!rule) {
    return {
      passed: false,
      feedback: "No ingress rule allows pods labeled app=web. Check ingress[].from[].podSelector.matchLabels.",
    };
  }
  const portOk = (rule.ports ?? []).some(
    (p) => portNum(p.port) === 5432 && (!p.protocol || p.protocol === "TCP"),
  );
  if (!portOk) {
    return { passed: false, feedback: "The allowed rule must be limited to TCP port 5432." };
  }
  const tooOpen = ((rule._from ?? []) as NetpolPeer[]).some(
    (f) => !f.podSelector && !f.namespaceSelector,
  );
  if (tooOpen) {
    return {
      passed: false,
      feedback: "One of the from entries has no selector at all — that allows everything.",
    };
  }
  return {
    passed: true,
    feedback:
      "db is now default-deny with a single web-only, port-5432 opening — batch is locked out. (kind's default CNI doesn't enforce policies, but the object is exactly what the exam grades.)",
  };
}

export async function checkNetpolFix(namespace: string): Promise<CheckResult> {
  const np = await orNotFound(
    networkingApi().readNamespacedNetworkPolicy({ name: "backend-allow", namespace }),
  );
  if (!np) return { passed: false, feedback: "NetworkPolicy backend-allow is gone — fix it, don't delete it." };
  if (np.spec?.podSelector?.matchLabels?.app !== "backend") {
    return { passed: false, feedback: "spec.podSelector must still protect the backend pods (app=backend)." };
  }
  const rules = np.spec?.ingress ?? [];
  // client-node's codegen renames the YAML `from` field to `_from`.
  const rule = rules.find((r) =>
    ((r._from ?? []) as NetpolPeer[]).some((f) => f.podSelector?.matchLabels?.app === "frontend"),
  );
  if (!rule) {
    return {
      passed: false,
      feedback:
        "No ingress rule allows pods labeled app=frontend anymore — don't remove that selector, just fix its port.",
    };
  }
  const portOk = (rule.ports ?? []).some(
    (p) => portNum(p.port) === 8080 && (!p.protocol || p.protocol === "TCP"),
  );
  if (!portOk) {
    return {
      passed: false,
      feedback: "backend-allow still doesn't open TCP 8080 — backend moved off port 80 last release.",
    };
  }
  const tooOpen = ((rule._from ?? []) as NetpolPeer[]).some(
    (f) => !f.podSelector && !f.namespaceSelector,
  );
  if (tooOpen) {
    return {
      passed: false,
      feedback: "One of the from entries has no selector at all — that allows everyone, not just frontend.",
    };
  }
  return {
    passed: true,
    feedback:
      "backend-allow now matches backend's real port (8080) while still scoped to frontend only — the fix was narrowing the gap, not opening the policy wide.",
  };
}
