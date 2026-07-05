import type { ClusterState } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  type ExecResult,
} from "./helpers";
import { lookupResource } from "../resources";

export function handleAutoscale(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed || parsed.info.key !== "deployments") {
    return err("error: autoscale is supported for deployments here");
  }
  const { name } = parsed;
  if (!name) return err("error: you must specify the deployment name");
  const ns = resolveNamespace(cmd, state);
  const dep = state.deployments.find(
    (d) => d.metadata.name === name && (d.metadata.namespace ?? "default") === ns,
  );
  if (!dep) return notFoundError(lookupResource("deploy")!, name, ns);

  const max = flagStr(cmd, "--max");
  if (!max) return err("error: --max is required");
  const min = flagStr(cmd, "--min") ?? "1";
  const cpu = flagStr(cmd, "--cpu-percent");

  if (state.hpas.some((h) => h.name === name && h.namespace === ns)) {
    return err(`Error from server (AlreadyExists): horizontalpodautoscalers.autoscaling "${name}" already exists`);
  }
  state.hpas.push({
    name,
    namespace: ns,
    refKind: "Deployment",
    refName: name,
    minReplicas: parseInt(min, 10),
    maxReplicas: parseInt(max, 10),
    ...(cpu ? { cpuPercent: parseInt(cpu, 10) } : {}),
  });
  return ok(`horizontalpodautoscaler.autoscaling/${name} autoscaled`);
}
