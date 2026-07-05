import type { ClusterState } from "../cluster-state";
import { formatTable } from "../format";
import type { ParsedCommand } from "../parser";
import { err, ok, type ExecResult } from "./helpers";

export function handleConfig(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [sub, arg] = cmd.args;
  switch (sub) {
    case "current-context":
      return ok(state.currentContext);
    case "get-contexts": {
      const rows = state.contexts.map((c) => [
        c.name === state.currentContext ? "*" : "",
        c.name,
        c.cluster,
        c.user,
        c.namespace ?? "",
      ]);
      return ok(formatTable(["CURRENT", "NAME", "CLUSTER", "AUTHINFO", "NAMESPACE"], rows));
    }
    case "use-context": {
      if (!arg) return err("error: you must specify a context name");
      const ctx = state.contexts.find((c) => c.name === arg);
      if (!ctx) return err(`error: no context exists with the name: "${arg}"`);
      state.currentContext = arg;
      return ok(`Switched to context "${arg}".`);
    }
    case "set-context": {
      // Only the common exam use: kubectl config set-context --current --namespace=X
      if (cmd.flags["--current"] === true || arg === "--current") {
        const nsFlag = cmd.flags["--namespace"];
        if (typeof nsFlag !== "string") return err("error: --namespace is required with --current here");
        const ctx = state.contexts.find((c) => c.name === state.currentContext);
        if (!ctx) return err("error: current context not found");
        ctx.namespace = nsFlag;
        return ok(`Context "${state.currentContext}" modified.`);
      }
      return err("error: only 'kubectl config set-context --current --namespace=<ns>' is supported here");
    }
    default:
      return err(
        `error: unknown config subcommand "${sub ?? ""}" (supported: current-context, get-contexts, use-context, set-context --current)`,
      );
  }
}
