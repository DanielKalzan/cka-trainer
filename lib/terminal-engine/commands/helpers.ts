import { dump } from "js-yaml";
import type {
  ClusterState,
  K8sDeployment,
  K8sPod,
  K8sObject,
} from "../cluster-state";
import { podSuffix, rsHash, SIM_NOW } from "../format";
import { flagStr, type ParsedCommand } from "../parser";
import { lookupResource, type ResourceInfo } from "../resources";

export interface EditorRequest {
  mode: "apply" | "edit";
  initialYaml: string;
  /** Set for edit mode so the engine knows what to replace on save. */
  target?: { kind: string; name: string; namespace?: string };
}

export interface ExecResult {
  output: string;
  exitCode: number;
  editor?: EditorRequest;
}

export function ok(output = ""): ExecResult {
  return { output, exitCode: 0 };
}

export function err(output: string): ExecResult {
  return { output, exitCode: 1 };
}

export function notFoundError(info: ResourceInfo, name: string, namespace?: string): ExecResult {
  const scope = info.namespaced && namespace ? ` in namespace "${namespace}"` : "";
  return err(`Error from server (NotFound): ${info.fullName} "${name}" not found${scope}`);
}

export const SIM_TIMESTAMP = new Date(SIM_NOW).toISOString().replace(/\.\d+Z$/, "Z");

export function currentNamespace(state: ClusterState): string {
  const ctx = state.contexts.find((c) => c.name === state.currentContext);
  return ctx?.namespace ?? "default";
}

export function resolveNamespace(cmd: ParsedCommand, state: ClusterState): string {
  return flagStr(cmd, "--namespace") ?? currentNamespace(state);
}

/** Parse "type/name" or [type, name] positionals. Returns null on unknown type. */
export function parseTypeName(
  args: string[],
): { info: ResourceInfo; name?: string; rest: string[] } | null {
  if (args.length === 0) return null;
  const first = args[0];
  if (first.includes("/")) {
    const [t, n] = first.split("/");
    const info = lookupResource(t);
    if (!info) return null;
    return { info, name: n, rest: args.slice(1) };
  }
  const info = lookupResource(first);
  if (!info) return null;
  return { info, name: args[1], rest: args.slice(2) };
}

export function matchesSelector(
  labels: Record<string, string> | undefined,
  selector: string,
): boolean {
  return selector.split(",").every((clause) => {
    const c = clause.trim();
    if (c.includes("!=")) {
      const [k, v] = c.split("!=");
      return (labels?.[k.trim()] ?? "") !== v.trim();
    }
    const [k, v] = c.split("=").filter((s) => s !== "");
    if (v === undefined) return labels?.[k.trim()] !== undefined;
    return labels?.[k.trim()] === v.trim();
  });
}

/** Fields that exist only for the simulator and must not leak into YAML output. */
const SIM_ONLY_FIELDS = ["mockLogs", "mockExec", "roles", "rolloutHistory", "ownerDeployment"];

export function toYaml(obj: K8sObject): string {
  const clean = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  for (const f of SIM_ONLY_FIELDS) delete clean[f];
  return dump(clean, { noRefs: true, lineWidth: 120 });
}

export function findSchedulableNode(state: ClusterState, excludeNode?: string): string | undefined {
  const node = state.nodes.find(
    (n) =>
      n.metadata.name !== excludeNode &&
      !n.spec.unschedulable &&
      !(n.spec.taints ?? []).some((t) => t.effect === "NoSchedule") &&
      n.status.conditions.some((c) => c.type === "Ready" && c.status === "True"),
  );
  return node?.metadata.name;
}

export function makeRunningPod(
  name: string,
  namespace: string,
  spec: K8sPod["spec"],
  labels: Record<string, string>,
  state: ClusterState,
): K8sPod {
  const nodeName = spec.nodeName ?? findSchedulableNode(state);
  const scheduled = nodeName !== undefined;
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace, labels, creationTimestamp: SIM_TIMESTAMP },
    spec: { ...spec, nodeName },
    status: scheduled
      ? {
          phase: "Running",
          podIP: `10.244.1.${(name.length * 7) % 250}`,
          containerStatuses: spec.containers.map((c) => ({
            name: c.name,
            ready: true,
            restartCount: 0,
            state: "Running",
          })),
        }
      : {
          phase: "Pending",
          reason: "Unschedulable",
          message: "0/{n} nodes are available",
          containerStatuses: spec.containers.map((c) => ({
            name: c.name,
            ready: false,
            restartCount: 0,
            state: "Pending",
          })),
        },
  };
}

/**
 * Reconcile ReplicaSet + Pods for a Deployment after create/scale/set-image/
 * apply. Keeps `kubectl get pods` believable without a real controller loop.
 */
export function syncDeployment(state: ClusterState, dep: K8sDeployment): void {
  const ns = dep.metadata.namespace ?? "default";
  const revision = dep.rolloutHistory?.length
    ? dep.rolloutHistory[dep.rolloutHistory.length - 1].revision
    : 1;
  const image = dep.spec.template.spec.containers[0]?.image ?? "unknown";
  const hash = rsHash(`${dep.metadata.name}-${revision}-${image}`);
  const rsName = `${dep.metadata.name}-${hash}`;

  // Retire old RS/pods belonging to this deployment
  state.replicasets = state.replicasets.filter(
    (rs) => !(rs.ownerDeployment === dep.metadata.name && rs.metadata.namespace === ns && rs.metadata.name !== rsName),
  );
  state.pods = state.pods.filter(
    (p) =>
      !(
        p.metadata.namespace === ns &&
        matchesSelector(p.metadata.labels, selectorToString(dep.spec.selector.matchLabels)) &&
        !p.metadata.name.startsWith(`${rsName}-`)
      ),
  );

  let rs = state.replicasets.find(
    (r) => r.metadata.name === rsName && r.metadata.namespace === ns,
  );
  if (!rs) {
    rs = {
      apiVersion: "apps/v1",
      kind: "ReplicaSet",
      metadata: {
        name: rsName,
        namespace: ns,
        labels: { ...dep.spec.template.metadata.labels, "pod-template-hash": hash },
        creationTimestamp: SIM_TIMESTAMP,
      },
      spec: {
        replicas: dep.spec.replicas,
        selector: { matchLabels: { ...dep.spec.selector.matchLabels, "pod-template-hash": hash } },
        template: dep.spec.template,
      },
      status: { replicas: dep.spec.replicas, readyReplicas: dep.spec.replicas },
      ownerDeployment: dep.metadata.name,
    };
    state.replicasets.push(rs);
  } else {
    rs.spec.replicas = dep.spec.replicas;
    rs.status = { replicas: dep.spec.replicas, readyReplicas: dep.spec.replicas };
  }

  const owned = state.pods.filter(
    (p) => p.metadata.namespace === ns && p.metadata.name.startsWith(`${rsName}-`),
  );
  for (let i = owned.length; i < dep.spec.replicas; i++) {
    const podName = `${rsName}-${podSuffix(`${rsName}-${i}`)}`;
    state.pods.push(
      makeRunningPod(
        podName,
        ns,
        dep.spec.template.spec,
        { ...dep.spec.template.metadata.labels, "pod-template-hash": hash },
        state,
      ),
    );
  }
  if (owned.length > dep.spec.replicas) {
    const excess = owned.slice(dep.spec.replicas).map((p) => p.metadata.name);
    state.pods = state.pods.filter(
      (p) => !(p.metadata.namespace === ns && excess.includes(p.metadata.name)),
    );
  }

  dep.status = {
    replicas: dep.spec.replicas,
    readyReplicas: dep.spec.replicas,
    availableReplicas: dep.spec.replicas,
    updatedReplicas: dep.spec.replicas,
  };
}

export function selectorToString(matchLabels: Record<string, string>): string {
  return Object.entries(matchLabels)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}
