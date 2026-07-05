import type { ClusterState } from "../cluster-state";
import { flagBool, type ParsedCommand } from "../parser";
import { podSuffix } from "../format";
import { err, findSchedulableNode, makeRunningPod, ok, type ExecResult } from "./helpers";

function getNode(state: ClusterState, name: string | undefined) {
  if (!name) return undefined;
  return state.nodes.find((n) => n.metadata.name === name);
}

export function handleCordon(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const node = getNode(state, cmd.args[0]);
  if (!node) return err(`Error from server (NotFound): nodes "${cmd.args[0] ?? ""}" not found`);
  node.spec.unschedulable = true;
  return ok(`node/${node.metadata.name} cordoned`);
}

export function handleUncordon(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const node = getNode(state, cmd.args[0]);
  if (!node) return err(`Error from server (NotFound): nodes "${cmd.args[0] ?? ""}" not found`);
  node.spec.unschedulable = false;
  return ok(`node/${node.metadata.name} uncordoned`);
}

export function handleDrain(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const node = getNode(state, cmd.args[0]);
  if (!node) return err(`Error from server (NotFound): nodes "${cmd.args[0] ?? ""}" not found`);
  const nodeName = node.metadata.name;

  const podsHere = state.pods.filter((p) => p.spec.nodeName === nodeName);
  const isDaemon = (p: (typeof podsHere)[number]) =>
    p.metadata.annotations?.["kubernetes.io/managed-by"] === "DaemonSet" ||
    p.metadata.labels?.["k8s-app"] !== undefined;
  const daemonPods = podsHere.filter(isDaemon);
  const normalPods = podsHere.filter((p) => !isDaemon(p));

  if (daemonPods.length > 0 && !flagBool(cmd, "--ignore-daemonsets")) {
    return err(
      `node/${nodeName} cordoned\nerror: unable to drain node "${nodeName}" due to error: cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore): ${daemonPods
        .map((p) => `${p.metadata.namespace}/${p.metadata.name}`)
        .join(", ")}`,
    );
  }

  // Bare pods (no RS owner) need --force
  const isOwned = (p: (typeof podsHere)[number]) =>
    state.replicasets.some(
      (rs) =>
        (rs.metadata.namespace ?? "default") === (p.metadata.namespace ?? "default") &&
        Object.entries(rs.spec.selector.matchLabels).every(
          ([k, v]) => p.metadata.labels?.[k] === v,
        ),
    );
  const barePods = normalPods.filter((p) => !isOwned(p));
  if (barePods.length > 0 && !flagBool(cmd, "--force")) {
    return err(
      `node/${nodeName} cordoned\nerror: unable to drain node "${nodeName}" due to error: cannot delete Pods that declare no controller (use --force to override): ${barePods
        .map((p) => `${p.metadata.namespace}/${p.metadata.name}`)
        .join(", ")}`,
    );
  }

  node.spec.unschedulable = true;

  const lines = [`node/${nodeName} cordoned`];
  for (const pod of normalPods) {
    state.pods = state.pods.filter((p) => p !== pod);
    lines.push(`evicting pod ${pod.metadata.namespace}/${pod.metadata.name}`);
    if (isOwned(pod)) {
      // Controller reschedules elsewhere (or leaves Pending if nowhere to go)
      const rs = state.replicasets.find(
        (r) =>
          (r.metadata.namespace ?? "default") === (pod.metadata.namespace ?? "default") &&
          Object.entries(r.spec.selector.matchLabels).every(
            ([k, v]) => pod.metadata.labels?.[k] === v,
          ),
      )!;
      const target = findSchedulableNode(state, nodeName);
      const newName = `${rs.metadata.name}-${podSuffix(`${pod.metadata.name}-drained`)}`;
      const replacement = makeRunningPod(
        newName,
        pod.metadata.namespace ?? "default",
        { ...rs.spec.template.spec, nodeName: target },
        { ...rs.spec.template.metadata.labels },
        state,
      );
      if (!target) {
        replacement.spec.nodeName = undefined;
        replacement.status = {
          phase: "Pending",
          reason: undefined,
          message: "0 nodes are available: all nodes are unschedulable",
          containerStatuses: [],
        };
      }
      state.pods.push(replacement);
    }
  }
  lines.push(`node/${nodeName} drained`);
  return ok(lines.join("\n"));
}
