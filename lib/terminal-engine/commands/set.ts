import type { ClusterState } from "../cluster-state";
import type { ParsedCommand } from "../parser";
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

export function handleSet(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [sub, ...rest] = cmd.args;
  if (sub !== "image") return err(`error: unknown subcommand "${sub ?? ""}" (supported: image)`);

  // kubectl set image deployment/web nginx=nginx:1.28  OR  deployment web nginx=nginx:1.28
  const kvIndex = rest.findIndex((t) => t.includes("=") && !t.startsWith("-"));
  if (kvIndex === -1) return err("error: CONTAINER=IMAGE pair is required");
  const typeNameArgs = rest.slice(0, kvIndex);
  const pairs = rest.slice(kvIndex);

  const parsed = parseTypeName(typeNameArgs);
  if (!parsed || parsed.info.key !== "deployments") {
    return err("error: set image is supported for deployments here (e.g. kubectl set image deployment/web app=nginx:1.28)");
  }
  const { name } = parsed;
  if (!name) return err("error: you must specify the deployment name");
  const ns = resolveNamespace(cmd, state);
  const dep = state.deployments.find(
    (d) => d.metadata.name === name && (d.metadata.namespace ?? "default") === ns,
  );
  if (!dep) return notFoundError(lookupResource("deploy")!, name, ns);

  let changed = false;
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    const containerName = pair.slice(0, eq);
    const image = pair.slice(eq + 1);
    const target =
      containerName === "*"
        ? dep.spec.template.spec.containers
        : dep.spec.template.spec.containers.filter((c) => c.name === containerName);
    if (target.length === 0) {
      return err(`error: unable to find container named "${containerName}"`);
    }
    for (const c of target) {
      if (c.image !== image) {
        c.image = image;
        changed = true;
      }
    }
  }
  if (changed) {
    const hist = dep.rolloutHistory ?? [];
    const last = hist[hist.length - 1];
    dep.rolloutHistory = [
      ...hist,
      {
        revision: (last?.revision ?? 0) + 1,
        image: dep.spec.template.spec.containers[0].image,
        ...(cmd.flags["--record"] === true
          ? { changeCause: `kubectl set image ${cmd.args.join(" ")}` }
          : {}),
      },
    ];
    syncDeployment(state, dep);
  }
  return ok(`deployment.apps/${name} image updated`);
}
