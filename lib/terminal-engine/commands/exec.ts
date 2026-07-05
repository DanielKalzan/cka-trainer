import type { ClusterState } from "../cluster-state";
import type { ParsedCommand } from "../parser";
import { err, ok, resolveNamespace, type ExecResult } from "./helpers";

export function handleExec(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const podName = cmd.args[0];
  if (!podName) return err("error: pod name is required");
  const ns = resolveNamespace(cmd, state);
  const pod = state.pods.find(
    (p) => p.metadata.name === podName && (p.metadata.namespace ?? "default") === ns,
  );
  if (!pod) return err(`Error from server (NotFound): pods "${podName}" not found in namespace "${ns}"`);
  if (pod.status.phase !== "Running") {
    return err(
      `error: unable to upgrade connection: container not running (${pod.status.containerStatuses?.[0]?.state ?? pod.status.phase})`,
    );
  }
  if (cmd.trailing.length === 0) {
    return err("error: you must specify at least one command for the container (after --)");
  }
  const command = cmd.trailing.join(" ");
  const mocked = pod.mockExec?.[command];
  if (mocked !== undefined) return ok(mocked);

  // A few generic fallbacks so the terminal feels alive
  if (command === "hostname") return ok(pod.metadata.name);
  if (command.startsWith("echo ")) return ok(command.slice(5).replace(/^["']|["']$/g, ""));
  if (command === "env" || command === "printenv") {
    const envs = pod.spec.containers[0]?.env ?? [];
    return ok(
      [
        `KUBERNETES_SERVICE_HOST=10.96.0.1`,
        `KUBERNETES_SERVICE_PORT=443`,
        `HOSTNAME=${pod.metadata.name}`,
        ...envs.map((e) => `${e.name}=${e.value ?? ""}`),
      ].join("\n"),
    );
  }
  if (command === "ls" || command === "ls /") {
    return ok("bin\ndev\netc\nhome\nproc\nroot\nsys\ntmp\nusr\nvar");
  }
  return ok(`(simulated) executed '${command}' in ${pod.metadata.name}`);
}
