import type { ClusterState } from "../cluster-state";
import { formatTable, pseudoHash } from "../format";
import { flagBool, type ParsedCommand } from "../parser";
import { err, ok, resolveNamespace, type ExecResult } from "./helpers";

function fakeNumber(seed: string, min: number, max: number): number {
  const h = pseudoHash(seed, 4, "0123456789");
  return min + (parseInt(h, 10) % (max - min));
}

export function handleTop(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [what] = cmd.args;
  if (what === "node" || what === "nodes" || what === "no") {
    const rows = state.nodes.map((n) => {
      const cpu = fakeNumber(`cpu-${n.metadata.name}`, 80, 900);
      const memMi = fakeNumber(`mem-${n.metadata.name}`, 800, 3500);
      return [
        n.metadata.name,
        `${cpu}m`,
        `${Math.round(cpu / 40)}%`,
        `${memMi}Mi`,
        `${Math.round(memMi / 80)}%`,
      ];
    });
    return ok(formatTable(["NAME", "CPU(cores)", "CPU%", "MEMORY(bytes)", "MEMORY%"], rows));
  }
  if (what === "pod" || what === "pods" || what === "po") {
    const ns = resolveNamespace(cmd, state);
    const all = flagBool(cmd, "-A") || flagBool(cmd, "--all-namespaces");
    const pods = state.pods.filter(
      (p) => p.status.phase === "Running" && (all || (p.metadata.namespace ?? "default") === ns),
    );
    if (pods.length === 0) return ok(`No resources found in ${ns} namespace.`);
    let headers = ["NAME", "CPU(cores)", "MEMORY(bytes)"];
    let rows = pods.map((p) => [
      p.metadata.name,
      `${fakeNumber(`cpu-${p.metadata.name}`, 1, 250)}m`,
      `${fakeNumber(`mem-${p.metadata.name}`, 10, 500)}Mi`,
    ]);
    if (all) {
      headers = ["NAMESPACE", ...headers];
      rows = rows.map((r, i) => [pods[i].metadata.namespace ?? "default", ...r]);
    }
    return ok(formatTable(headers, rows));
  }
  return err("error: unknown command: supported are 'kubectl top node' and 'kubectl top pod'");
}
