import { load } from "js-yaml";
import type { ClusterState, K8sDeployment, K8sObject } from "../cluster-state";
import type { ParsedCommand } from "../parser";
import { getList, lookupResourceByKind } from "../resources";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  syncDeployment,
  toYaml,
  type ExecResult,
} from "./helpers";

export function handleEdit(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  const { info, name } = parsed;
  if (!name) return err("error: you must specify the name of the resource to edit");
  const ns = resolveNamespace(cmd, state);
  const obj = (getList(state, info) as K8sObject[]).find(
    (o) =>
      o.metadata.name === name && (!info.namespaced || (o.metadata.namespace ?? "default") === ns),
  );
  if (!obj) return notFoundError(info, name, ns);
  return {
    output: "",
    exitCode: 0,
    editor: {
      mode: "edit",
      initialYaml: toYaml(obj),
      target: { kind: obj.kind, name: obj.metadata.name, namespace: obj.metadata.namespace },
    },
  };
}

/** Editor save path for `kubectl edit`: replaces the target object with the edited YAML. */
export function applyEditedYaml(
  state: ClusterState,
  target: { kind: string; name: string; namespace?: string },
  yamlText: string,
): ExecResult {
  let doc: unknown;
  try {
    doc = load(yamlText);
  } catch (e) {
    return err(`error: error parsing YAML: ${e instanceof Error ? e.message : String(e)}\nedit cancelled, no changes made.`);
  }
  const obj = doc as Partial<K8sObject> & Record<string, unknown>;
  if (!obj.kind || !obj.metadata?.name) {
    return err("error: edited object must keep kind and metadata.name\nedit cancelled, no changes made.");
  }
  if (obj.kind !== target.kind || obj.metadata.name !== target.name) {
    return err("error: the edited object's kind/name may not change\nedit cancelled, no changes made.");
  }
  const info = lookupResourceByKind(obj.kind);
  if (!info) return err(`error: no matches for kind "${obj.kind}"`);
  const list = getList(state, info) as (K8sObject & Record<string, unknown>)[];
  const idx = list.findIndex(
    (o) =>
      o.metadata.name === target.name &&
      (!info.namespaced || (o.metadata.namespace ?? "default") === (target.namespace ?? "default")),
  );
  if (idx === -1) return err(`error: the object was deleted while being edited`);

  // Preserve simulator-only fields the YAML round-trip strips
  const prev = list[idx] as Record<string, unknown>;
  for (const f of ["mockLogs", "mockExec", "roles", "rolloutHistory", "ownerDeployment"]) {
    if (prev[f] !== undefined && obj[f] === undefined) obj[f] = prev[f];
  }
  list[idx] = obj as K8sObject & Record<string, unknown>;

  if (info.key === "deployments") {
    const dep = obj as unknown as K8sDeployment;
    const image = dep.spec.template.spec.containers[0]?.image ?? "unknown";
    const hist = dep.rolloutHistory ?? [];
    const last = hist[hist.length - 1];
    if (!last || last.image !== image) {
      dep.rolloutHistory = [...hist, { revision: (last?.revision ?? 0) + 1, image }];
    }
    syncDeployment(state, dep);
  }
  return ok(`${info.fullName}/${target.name} edited`);
}
