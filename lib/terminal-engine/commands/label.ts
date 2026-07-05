import type { ClusterState, K8sObject } from "../cluster-state";
import { flagBool, type ParsedCommand } from "../parser";
import { getList } from "../resources";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  type ExecResult,
} from "./helpers";

/** Shared by `kubectl label` and `kubectl annotate`. */
export function handleLabelOrAnnotate(
  state: ClusterState,
  cmd: ParsedCommand,
  field: "labels" | "annotations",
): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  const { info, name, rest } = parsed;
  if (!name) return err(`error: you must specify the name of the resource`);
  const kvs = rest;
  if (kvs.length === 0) return err(`error: at least one ${field.slice(0, -1)} update is required`);

  const ns = resolveNamespace(cmd, state);
  const obj = (getList(state, info) as K8sObject[]).find(
    (o) =>
      o.metadata.name === name && (!info.namespaced || (o.metadata.namespace ?? "default") === ns),
  );
  if (!obj) return notFoundError(info, name, ns);

  const map = { ...(obj.metadata[field] ?? {}) };
  for (const kv of kvs) {
    if (kv.endsWith("-") && !kv.includes("=")) {
      delete map[kv.slice(0, -1)];
      continue;
    }
    const eq = kv.indexOf("=");
    if (eq === -1) return err(`error: invalid ${field.slice(0, -1)} "${kv}", expected key=value or key-`);
    const key = kv.slice(0, eq);
    const value = kv.slice(eq + 1);
    if (map[key] !== undefined && map[key] !== value && !flagBool(cmd, "--overwrite")) {
      return err(
        `error: '${key}' already has a value (${map[key]}), and --overwrite is false`,
      );
    }
    map[key] = value;
  }
  obj.metadata[field] = map;
  const verb = field === "labels" ? "labeled" : "annotated";
  return ok(`${info.fullName}/${name} ${verb}`);
}
