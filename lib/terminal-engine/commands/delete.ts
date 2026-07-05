import type { ClusterState, K8sObject, K8sPod, K8sReplicaSet } from "../cluster-state";
import { flagBool, flagStr, type ParsedCommand } from "../parser";
import { getList } from "../resources";
import { podSuffix } from "../format";
import {
  err,
  makeRunningPod,
  matchesSelector,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  type ExecResult,
} from "./helpers";

/** After a pod delete, its owning RS (if any) recreates a replacement — like the real controller. */
function reconcileAfterPodDelete(state: ClusterState, deleted: K8sPod): void {
  const ns = deleted.metadata.namespace ?? "default";
  const owner = state.replicasets.find(
    (rs) =>
      (rs.metadata.namespace ?? "default") === ns &&
      Object.entries(rs.spec.selector.matchLabels).every(
        ([k, v]) => deleted.metadata.labels?.[k] === v,
      ),
  );
  if (!owner) return;
  const ownedCount = state.pods.filter(
    (p) =>
      (p.metadata.namespace ?? "default") === ns &&
      Object.entries(owner.spec.selector.matchLabels).every(
        ([k, v]) => p.metadata.labels?.[k] === v,
      ),
  ).length;
  if (ownedCount >= owner.spec.replicas) return;
  const newName = `${owner.metadata.name}-${podSuffix(`${deleted.metadata.name}-replacement`)}`;
  state.pods.push(
    makeRunningPod(
      newName,
      ns,
      owner.spec.template.spec,
      { ...owner.spec.template.metadata.labels },
      state,
    ),
  );
}

function cascadeDelete(state: ClusterState, key: string, obj: K8sObject): void {
  const ns = obj.metadata.namespace ?? "default";
  if (key === "deployments") {
    const doomedRs = state.replicasets.filter(
      (rs) => rs.ownerDeployment === obj.metadata.name && (rs.metadata.namespace ?? "default") === ns,
    );
    for (const rs of doomedRs) cascadeDelete(state, "replicasets", rs);
    state.replicasets = state.replicasets.filter((rs) => !doomedRs.includes(rs));
  }
  if (key === "replicasets") {
    const rs = obj as K8sReplicaSet;
    state.pods = state.pods.filter(
      (p) =>
        !(
          (p.metadata.namespace ?? "default") === ns &&
          Object.entries(rs.spec.selector.matchLabels).every(
            ([k, v]) => p.metadata.labels?.[k] === v,
          )
        ),
    );
  }
}

export function handleDelete(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  const { info, name, rest } = parsed;
  const ns = resolveNamespace(cmd, state);
  const selector = flagStr(cmd, "--selector");
  const all = flagBool(cmd, "--all");

  const list = getList(state, info) as (K8sObject & Record<string, unknown>)[];
  const inScope = (o: K8sObject) =>
    !info.namespaced || (o.metadata.namespace ?? "default") === ns;

  let targets: (K8sObject & Record<string, unknown>)[];
  if (selector) {
    targets = list.filter((o) => inScope(o) && matchesSelector(o.metadata.labels, selector));
  } else if (all) {
    targets = list.filter(inScope);
  } else {
    const names = [name, ...rest].filter((n): n is string => !!n);
    if (names.length === 0) return err("error: resource(s) were provided, but no name was specified");
    targets = [];
    for (const n of names) {
      const obj = list.find((o) => o.metadata.name === n && inScope(o));
      if (!obj) return notFoundError(info, n, ns);
      targets.push(obj);
    }
  }
  if (targets.length === 0) return ok("No resources found");

  const lines: string[] = [];
  for (const obj of targets) {
    cascadeDelete(state, info.key, obj);
    const arr = getList(state, info) as (K8sObject & Record<string, unknown>)[];
    const idx = arr.indexOf(obj);
    if (idx >= 0) arr.splice(idx, 1);
    lines.push(`${info.fullName.split(".")[0]} "${obj.metadata.name}" deleted`);
    if (info.key === "pods") reconcileAfterPodDelete(state, obj as unknown as K8sPod);
  }
  return ok(lines.join("\n"));
}
