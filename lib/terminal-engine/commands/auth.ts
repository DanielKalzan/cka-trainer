import type { ClusterState, PolicyRule, RbacSubject } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import { err, ok, resolveNamespace, type ExecResult } from "./helpers";

function subjectMatches(subject: RbacSubject, asUser: string): boolean {
  if (asUser.startsWith("system:serviceaccount:")) {
    const [, , ns, name] = asUser.split(":");
    return subject.kind === "ServiceAccount" && subject.name === name && subject.namespace === ns;
  }
  return (subject.kind === "User" || subject.kind === "Group") && subject.name === asUser;
}

function ruleAllows(rule: PolicyRule, verb: string, resource: string): boolean {
  const verbOk = rule.verbs.includes("*") || rule.verbs.includes(verb);
  const resOk = rule.resources.includes("*") || rule.resources.includes(resource);
  return verbOk && resOk;
}

/** Normalize singular/alias to the plural resource token used in rules. */
function normalizeResource(token: string): string {
  const map: Record<string, string> = {
    po: "pods", pod: "pods",
    deploy: "deployments", deployment: "deployments",
    svc: "services", service: "services",
    node: "nodes", no: "nodes",
    secret: "secrets", cm: "configmaps", configmap: "configmaps",
    pv: "persistentvolumes", pvc: "persistentvolumeclaims",
    sa: "serviceaccounts", serviceaccount: "serviceaccounts",
    role: "roles", rolebinding: "rolebindings",
  };
  return map[token] ?? token;
}

export function handleAuth(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [sub, verb, resourceRaw] = cmd.args;
  if (sub !== "can-i") return err(`error: unknown auth subcommand "${sub ?? ""}" (supported: can-i)`);
  if (!verb || !resourceRaw) return err("error: usage: kubectl auth can-i VERB RESOURCE [--as=USER] [-n NAMESPACE]");
  const resource = normalizeResource(resourceRaw);
  const asUser = flagStr(cmd, "--as");
  const ns = resolveNamespace(cmd, state);

  // Without --as you are cluster-admin in the simulator.
  if (!asUser) return ok("yes");

  // ClusterRoleBindings grant everywhere
  for (const crb of state.clusterrolebindings) {
    if (!crb.subjects.some((s) => subjectMatches(s, asUser))) continue;
    const role = state.clusterroles.find((r) => r.metadata.name === crb.roleRef.name);
    if (role?.rules.some((rule) => ruleAllows(rule, verb, resource))) return ok("yes");
  }
  // RoleBindings grant within their namespace (may reference Role or ClusterRole)
  for (const rb of state.rolebindings) {
    if ((rb.metadata.namespace ?? "default") !== ns) continue;
    if (!rb.subjects.some((s) => subjectMatches(s, asUser))) continue;
    const rules =
      rb.roleRef.kind === "Role"
        ? state.roles.find(
            (r) => r.metadata.name === rb.roleRef.name && (r.metadata.namespace ?? "default") === ns,
          )?.rules
        : state.clusterroles.find((r) => r.metadata.name === rb.roleRef.name)?.rules;
    if (rules?.some((rule) => ruleAllows(rule, verb, resource))) return ok("yes");
  }
  return { output: "no", exitCode: 1 };
}
