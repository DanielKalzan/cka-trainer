import type { ClusterState } from "./cluster-state";
import { parseCommand, ParseError } from "./parser";
import { applyYamlText } from "./commands/apply";
import { handleApply } from "./commands/apply";
import { handleAuth } from "./commands/auth";
import { handleAutoscale } from "./commands/autoscale";
import { handleConfig } from "./commands/config";
import { handleCreate } from "./commands/create";
import { handleDelete } from "./commands/delete";
import { handleDescribe } from "./commands/describe";
import { applyEditedYaml, handleEdit } from "./commands/edit";
import { handleEtcdctl } from "./commands/etcdctl";
import { handleExec } from "./commands/exec";
import { handleExplain } from "./commands/explain";
import { handleExpose } from "./commands/expose";
import { handleGet } from "./commands/get";
import { err, ok, type EditorRequest, type ExecResult } from "./commands/helpers";
import { handleCordon, handleDrain, handleUncordon } from "./commands/drain";
import { handleLabelOrAnnotate } from "./commands/label";
import { handleLogs } from "./commands/logs";
import { handleRollout } from "./commands/rollout";
import { handleRun } from "./commands/run";
import { handleScale } from "./commands/scale";
import { handleSet } from "./commands/set";
import { handleTaint } from "./commands/taint";
import { handleTop } from "./commands/top";

export type { EditorRequest, ExecResult };
export { applyYamlText, applyEditedYaml };

/**
 * Executes one command line against the cluster state (mutating it).
 * Callers own state lifecycle: clone the fixture before a session, pass the
 * same object across calls, hand it to the exercise checker when grading.
 */
export function executeCommand(state: ClusterState, input: string): ExecResult {
  const trimmed = input.trim();
  if (trimmed === "") return ok("");

  // Shell niceties people type on reflex
  if (trimmed === "clear") return { output: "", exitCode: 0 };
  if (trimmed === "help") return ok(HELP_TEXT);

  let cmd;
  try {
    cmd = parseCommand(trimmed);
  } catch (e) {
    if (e instanceof ParseError) return err(`parse error: ${e.message}`);
    throw e;
  }

  // Strip leading VAR=value env assignments (ETCDCTL_API=3 etcdctl ...)
  while (/^[A-Z_][A-Z0-9_]*=/.test(cmd.bin)) {
    const next = cmd.args.shift();
    if (!next) return err(`${cmd.bin}: command not found`);
    cmd.bin = next;
  }

  switch (cmd.bin) {
    case "kubectl":
    case "k":
      return dispatchKubectl(state, cmd);
    case "etcdctl":
    case "etcdutl":
      return handleEtcdctl(state, cmd);
    case "alias":
      return ok("alias k='kubectl'");
    default:
      return err(`bash: ${cmd.bin}: command not found`);
  }
}

function dispatchKubectl(state: ClusterState, cmd: ReturnType<typeof parseCommand>): ExecResult {
  const verb = cmd.args.shift();
  if (!verb) {
    return ok('kubectl controls the Kubernetes cluster manager.\n\nUse "kubectl <command> --help" syntax is not simulated — type `help` for supported commands.');
  }
  switch (verb) {
    case "get":
      return handleGet(state, cmd);
    case "describe":
      return handleDescribe(state, cmd);
    case "create":
      return handleCreate(state, cmd);
    case "apply":
      return handleApply(state, cmd);
    case "delete":
      return handleDelete(state, cmd);
    case "edit":
      return handleEdit(state, cmd);
    case "scale":
      return handleScale(state, cmd);
    case "rollout":
      return handleRollout(state, cmd);
    case "label":
      return handleLabelOrAnnotate(state, cmd, "labels");
    case "annotate":
      return handleLabelOrAnnotate(state, cmd, "annotations");
    case "taint":
      return handleTaint(state, cmd);
    case "cordon":
      return handleCordon(state, cmd);
    case "uncordon":
      return handleUncordon(state, cmd);
    case "drain":
      return handleDrain(state, cmd);
    case "logs":
      return handleLogs(state, cmd);
    case "exec":
      return handleExec(state, cmd);
    case "config":
      return handleConfig(state, cmd);
    case "explain":
      return handleExplain(cmd);
    case "run":
      return handleRun(state, cmd);
    case "set":
      return handleSet(state, cmd);
    case "autoscale":
      return handleAutoscale(state, cmd);
    case "top":
      return handleTop(state, cmd);
    case "auth":
      return handleAuth(state, cmd);
    case "expose":
      return handleExpose(state, cmd);
    case "version":
      return ok("Client Version: v1.35.1\nServer Version: v1.35.1");
    case "api-resources":
      return ok("(simulator) supported resource types: pods, nodes, namespaces, deployments, replicasets, services, configmaps, secrets, pv, pvc, storageclasses, networkpolicies, roles, rolebindings, clusterroles, clusterrolebindings, serviceaccounts, events");
    default:
      return err(`error: unknown command "${verb}" for "kubectl"\n\nDid you mean one of: get, describe, create, apply, delete, edit? (type 'help' for the full list)`);
  }
}

const HELP_TEXT = `Simulated cluster terminal. Supported:

  kubectl get|describe|create|apply -f -|delete|edit|scale|rollout|label|annotate
          taint|cordon|uncordon|drain|logs|exec|run|expose|set image|autoscale
          top|config|explain|auth can-i|get events
  etcdctl snapshot save|restore|status
  k       alias for kubectl

Notes:
  - 'kubectl apply -f -' and 'kubectl edit <kind> <name>' open the YAML pane.
  - '--dry-run=client -o yaml' works on create/run/expose.
  - There is no filesystem; file paths only work for etcdctl snapshots.`;
