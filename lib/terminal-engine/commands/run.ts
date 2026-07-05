import type { ClusterState, K8sPod } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import {
  err,
  makeRunningPod,
  ok,
  resolveNamespace,
  toYaml,
  type ExecResult,
} from "./helpers";

export function handleRun(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const name = cmd.args[0];
  if (!name) return err("error: NAME is required");
  const image = flagStr(cmd, "--image");
  if (!image) return err("error: --image is required");
  const ns = resolveNamespace(cmd, state);

  const labels: Record<string, string> = { run: name };
  const selectorFlag = flagStr(cmd, "--labels") ?? flagStr(cmd, "--selector");
  if (selectorFlag) {
    for (const kv of selectorFlag.split(",")) {
      const [k, v] = kv.split("=");
      if (k && v !== undefined) labels[k] = v;
    }
  }

  const port = flagStr(cmd, "--port");
  const env = (cmd.repeated["--env"] ?? []).map((e) => {
    const eq = e.indexOf("=");
    return { name: e.slice(0, eq), value: e.slice(eq + 1) };
  });

  const spec: K8sPod["spec"] = {
    containers: [
      {
        name,
        image,
        ...(port ? { ports: [{ containerPort: parseInt(port, 10) }] } : {}),
        ...(env.length ? { env } : {}),
        ...(cmd.trailing.length > 0
          ? cmd.flags["--command"] !== undefined
            ? { command: cmd.trailing }
            : { args: cmd.trailing }
          : {}),
      },
    ],
    restartPolicy: (flagStr(cmd, "--restart") as K8sPod["spec"]["restartPolicy"]) ?? "Always",
  };

  const pod = makeRunningPod(name, ns, spec, labels, state);

  if (flagStr(cmd, "--dry-run") === "client") {
    if (flagStr(cmd, "--output") === "yaml") {
      // dry-run output shows the pod pre-scheduling: no nodeName, no status
      const clean = { ...pod, spec: { ...pod.spec, nodeName: undefined }, status: undefined };
      return ok(
        toYaml(clean as unknown as K8sPod)
          .replace(/^status: .*$\n?/m, "")
          .trimEnd(),
      );
    }
    return ok(`pod/${name} created (dry run)`);
  }

  if (state.pods.some((p) => p.metadata.name === name && (p.metadata.namespace ?? "default") === ns)) {
    return err(`Error from server (AlreadyExists): pods "${name}" already exists`);
  }
  state.pods.push(pod);
  return ok(`pod/${name} created`);
}
