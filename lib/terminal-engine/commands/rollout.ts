import type { ClusterState } from "../cluster-state";
import { formatTable } from "../format";
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

export function handleRollout(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [sub, ...rest] = cmd.args;
  if (!sub) return err('error: subcommand required: status, history or undo');
  const parsed = parseTypeName(rest);
  if (!parsed || parsed.info.key !== "deployments") {
    return err("error: rollout is supported for deployments here (e.g. kubectl rollout status deployment/web)");
  }
  const { name } = parsed;
  if (!name) return err("error: you must specify a deployment name");
  const ns = resolveNamespace(cmd, state);
  const dep = state.deployments.find(
    (d) => d.metadata.name === name && (d.metadata.namespace ?? "default") === ns,
  );
  if (!dep) return notFoundError(lookupResource("deploy")!, name, ns);

  switch (sub) {
    case "status": {
      const ready = dep.status.readyReplicas ?? 0;
      if (ready >= dep.spec.replicas) {
        return ok(`deployment "${name}" successfully rolled out`);
      }
      return ok(
        `Waiting for deployment "${name}" rollout to finish: ${ready} of ${dep.spec.replicas} updated replicas are available...`,
      );
    }
    case "history": {
      const hist = dep.rolloutHistory ?? [{ revision: 1, image: dep.spec.template.spec.containers[0]?.image ?? "?" }];
      const revisionFlag = flagStr(cmd, "--revision");
      if (revisionFlag) {
        const rev = hist.find((h) => h.revision === parseInt(revisionFlag, 10));
        if (!rev) return err(`error: unable to find the specified revision`);
        return ok(
          `deployment.apps/${name} with revision #${rev.revision}\nPod Template:\n  Containers:\n   ${dep.spec.template.spec.containers[0]?.name}:\n    Image:  ${rev.image}`,
        );
      }
      return ok(
        `deployment.apps/${name}\n` +
          formatTable(
            ["REVISION", "CHANGE-CAUSE"],
            hist.map((h) => [`${h.revision}`, h.changeCause ?? "<none>"]),
          ),
      );
    }
    case "undo": {
      const hist = dep.rolloutHistory ?? [];
      if (hist.length < 2) return err(`error: no rollout history found for deployment "${name}"`);
      const toRevisionFlag = flagStr(cmd, "--to-revision");
      let target;
      if (toRevisionFlag) {
        target = hist.find((h) => h.revision === parseInt(toRevisionFlag, 10));
        if (!target) return err(`error: unable to find specified revision ${toRevisionFlag} in history`);
      } else {
        target = hist[hist.length - 2];
      }
      const nextRevision = hist[hist.length - 1].revision + 1;
      dep.spec.template.spec.containers[0].image = target.image;
      dep.rolloutHistory = [
        ...hist.filter((h) => h.revision !== target.revision),
        { revision: nextRevision, image: target.image, changeCause: `rollback to revision ${target.revision}` },
      ];
      syncDeployment(state, dep);
      return ok(`deployment.apps/${name} rolled back`);
    }
    default:
      return err(`error: unknown rollout subcommand "${sub}" (supported: status, history, undo)`);
  }
}
