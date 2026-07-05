import type { ClusterState, Taint } from "../cluster-state";
import type { ParsedCommand } from "../parser";
import { err, ok, type ExecResult } from "./helpers";

const EFFECTS = ["NoSchedule", "PreferNoSchedule", "NoExecute"] as const;

export function handleTaint(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [resType, nodeName, ...taintArgs] = cmd.args;
  if (resType !== "node" && resType !== "nodes" && resType !== "no") {
    return err("error: taint is only supported for nodes");
  }
  if (!nodeName || taintArgs.length === 0) {
    return err("error: usage: kubectl taint nodes NODE key=value:Effect (append '-' to remove)");
  }
  const node = state.nodes.find((n) => n.metadata.name === nodeName);
  if (!node) return err(`Error from server (NotFound): nodes "${nodeName}" not found`);

  const lines: string[] = [];
  for (const spec of taintArgs) {
    const removing = spec.endsWith("-");
    const body = removing ? spec.slice(0, -1) : spec;
    const colon = body.lastIndexOf(":");
    let key = body;
    let value: string | undefined;
    let effect: Taint["effect"] | undefined;
    if (colon !== -1) {
      effect = body.slice(colon + 1) as Taint["effect"];
      key = body.slice(0, colon);
    }
    if (key.includes("=")) {
      const [k, v] = key.split("=");
      key = k;
      value = v;
    }
    if (!removing && (!effect || !EFFECTS.includes(effect))) {
      return err(`error: invalid taint effect: "${effect ?? ""}", unsupported taint effect (use ${EFFECTS.join(", ")})`);
    }
    node.spec.taints = node.spec.taints ?? [];
    if (removing) {
      const before = node.spec.taints.length;
      node.spec.taints = node.spec.taints.filter(
        (t) => !(t.key === key && (effect === undefined || t.effect === effect)),
      );
      if (node.spec.taints.length === before) {
        return err(`error: taint "${key}" not found on node ${nodeName}`);
      }
      lines.push(`node/${nodeName} untainted`);
    } else {
      const existing = node.spec.taints.find((t) => t.key === key && t.effect === effect);
      if (existing) {
        existing.value = value;
      } else {
        node.spec.taints.push({ key, value, effect: effect! });
      }
      lines.push(`node/${nodeName} tainted`);
    }
  }
  return ok(lines.join("\n"));
}
