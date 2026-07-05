import type { ClusterState } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import { err, ok, resolveNamespace, type ExecResult } from "./helpers";

export function handleLogs(state: ClusterState, cmd: ParsedCommand): ExecResult {
  let target = cmd.args[0];
  if (!target) return err("error: expected 'logs POD_NAME'");
  const ns = resolveNamespace(cmd, state);

  // logs deploy/web → first pod of the deployment
  if (target.includes("/")) {
    const [t, n] = target.split("/");
    if (t === "deploy" || t === "deployment") {
      const pod = state.pods.find(
        (p) =>
          (p.metadata.namespace ?? "default") === ns &&
          p.metadata.name.startsWith(`${n}-`),
      );
      if (!pod) return err(`error: no pods found for deployment "${n}"`);
      target = pod.metadata.name;
    } else {
      return err(`error: logs supports pods and deployments`);
    }
  }

  const pod = state.pods.find(
    (p) => p.metadata.name === target && (p.metadata.namespace ?? "default") === ns,
  );
  if (!pod) return err(`Error from server (NotFound): pods "${target}" not found in namespace "${ns}"`);

  const container = flagStr(cmd, "--container");
  if (pod.spec.containers.length > 1 && !container) {
    return err(
      `error: a container name must be specified for pod ${target}, choose one of: [${pod.spec.containers
        .map((c) => c.name)
        .join(" ")}]`,
    );
  }
  const key = container ?? pod.spec.containers[0]?.name ?? "";
  let logs = pod.mockLogs?.[key] ?? pod.mockLogs?.[""] ?? "";
  if (container && !pod.spec.containers.some((c) => c.name === container)) {
    return err(`error: container ${container} is not valid for pod ${target}`);
  }
  if (logs === "") {
    const status = pod.status.containerStatuses?.find((c) => c.name === key);
    if (status?.state === "ContainerCreating" || status?.state === "Pending") {
      return err(
        `Error from server (BadRequest): container "${key}" in pod "${target}" is waiting to start: ContainerCreating`,
      );
    }
    logs = `(no log output)`;
  }
  const tail = flagStr(cmd, "--tail");
  if (tail) {
    const n = parseInt(tail, 10);
    logs = logs.split("\n").slice(-n).join("\n");
  }
  return ok(logs);
}
