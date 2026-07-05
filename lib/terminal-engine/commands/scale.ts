import type { ClusterState, K8sDeployment } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  syncDeployment,
  type ExecResult,
} from "./helpers";
import { lookupResource } from "../resources";

export function handleScale(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  const { info, name } = parsed;
  if (!name) return err("error: you must specify the name of the resource to scale");
  const replicasStr = flagStr(cmd, "--replicas");
  if (replicasStr === undefined) return err("error: --replicas is required");
  const replicas = parseInt(replicasStr, 10);
  if (Number.isNaN(replicas) || replicas < 0) return err(`error: invalid replicas: "${replicasStr}"`);

  const ns = resolveNamespace(cmd, state);
  if (info.key === "deployments") {
    const dep = state.deployments.find(
      (d) => d.metadata.name === name && (d.metadata.namespace ?? "default") === ns,
    );
    if (!dep) return notFoundError(info, name, ns);
    dep.spec.replicas = replicas;
    syncDeployment(state, dep);
    return ok(`deployment.apps/${name} scaled`);
  }
  if (info.key === "replicasets") {
    const rs = state.replicasets.find(
      (r) => r.metadata.name === name && (r.metadata.namespace ?? "default") === ns,
    );
    if (!rs) return notFoundError(lookupResource("rs")!, name, ns);
    rs.spec.replicas = replicas;
    if (rs.ownerDeployment) {
      // Mirrors real behavior: the deployment controller will fight you.
      const dep = state.deployments.find(
        (d) => d.metadata.name === rs.ownerDeployment && (d.metadata.namespace ?? "default") === ns,
      ) as K8sDeployment | undefined;
      if (dep) syncDeployment(state, dep);
      return ok(
        `replicaset.apps/${name} scaled\n(note: this ReplicaSet is owned by deployment "${rs.ownerDeployment}" — the controller immediately reverted your scale, exactly like real Kubernetes)`,
      );
    }
    return ok(`replicaset.apps/${name} scaled`);
  }
  return err(`error: cannot scale resource type "${info.kind}"`);
}
