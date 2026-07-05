import { loadAll } from "js-yaml";
import type { ClusterState, K8sDeployment, K8sObject, K8sPod } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import { getList, lookupResourceByKind } from "../resources";
import {
  err,
  makeRunningPod,
  ok,
  SIM_TIMESTAMP,
  syncDeployment,
  type ExecResult,
} from "./helpers";

/**
 * Applies one or more YAML documents to the state. Used by `apply -f -`,
 * `create -f -` and the editor save path.
 */
export function applyYamlText(state: ClusterState, yamlText: string): ExecResult {
  let docs: unknown[];
  try {
    docs = loadAll(yamlText).filter((d) => d != null);
  } catch (e) {
    return err(`error: error parsing YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (docs.length === 0) return err("error: no objects passed to apply");

  const lines: string[] = [];
  for (const doc of docs) {
    const obj = doc as Partial<K8sObject> & Record<string, unknown>;
    if (!obj.kind || !obj.metadata?.name) {
      return err('error: error validating data: every object must have "kind" and "metadata.name"');
    }
    const info = lookupResourceByKind(obj.kind);
    if (!info) {
      return err(`error: unable to recognize input: no matches for kind "${obj.kind}"`);
    }
    if (info.namespaced && !obj.metadata.namespace) obj.metadata.namespace = "default";
    if (!obj.metadata.creationTimestamp) obj.metadata.creationTimestamp = SIM_TIMESTAMP;
    if (!obj.apiVersion) obj.apiVersion = info.apiVersion;

    const list = getList(state, info) as (K8sObject & Record<string, unknown>)[];
    const idx = list.findIndex(
      (o) =>
        o.metadata.name === obj.metadata!.name &&
        (!info.namespaced || (o.metadata.namespace ?? "default") === obj.metadata!.namespace),
    );

    // Kind-specific defaulting so applied objects behave in the simulator
    if (info.key === "pods") {
      const pod = obj as unknown as K8sPod;
      if (!pod.status || Object.keys(pod.status).length === 0) {
        const filled = makeRunningPod(
          pod.metadata.name,
          pod.metadata.namespace ?? "default",
          pod.spec,
          pod.metadata.labels ?? {},
          state,
        );
        pod.status = filled.status;
        pod.spec.nodeName = filled.spec.nodeName;
      }
    }
    if (info.key === "deployments") {
      const dep = obj as unknown as K8sDeployment;
      dep.spec.replicas = dep.spec.replicas ?? 1;
      if (!dep.status) dep.status = {};
      const prev = idx >= 0 ? (list[idx] as unknown as K8sDeployment) : undefined;
      const image = dep.spec.template.spec.containers[0]?.image ?? "unknown";
      if (prev?.rolloutHistory) {
        const last = prev.rolloutHistory[prev.rolloutHistory.length - 1];
        dep.rolloutHistory =
          last.image === image
            ? prev.rolloutHistory
            : [...prev.rolloutHistory, { revision: last.revision + 1, image }];
      } else {
        dep.rolloutHistory = [{ revision: 1, image }];
      }
    }

    if (idx >= 0) {
      list[idx] = obj as K8sObject & Record<string, unknown>;
      lines.push(`${info.fullName}/${obj.metadata.name} configured`);
    } else {
      list.push(obj as K8sObject & Record<string, unknown>);
      lines.push(`${info.fullName}/${obj.metadata.name} created`);
    }

    if (info.key === "deployments") {
      syncDeployment(state, obj as unknown as K8sDeployment);
    }
  }
  return ok(lines.join("\n"));
}

export function handleApply(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const filename = flagStr(cmd, "--filename");
  if (!filename) return err("error: must specify -f");
  if (filename !== "-") {
    return err(
      `error: the path "${filename}" does not exist\n(The simulator has no filesystem — use 'kubectl apply -f -' and paste YAML.)`,
    );
  }
  return { output: "", exitCode: 0, editor: { mode: "apply", initialYaml: "" } };
}
