import type {
  ClusterState,
  K8sConfigMap,
  K8sDeployment,
  K8sNamespace,
  K8sRole,
  K8sSecret,
  K8sServiceAccount,
  PolicyRule,
  RbacSubject,
} from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import { applyYamlText } from "./apply";
import {
  err,
  ok,
  resolveNamespace,
  SIM_TIMESTAMP,
  syncDeployment,
  toYaml,
  type ExecResult,
} from "./helpers";

function alreadyExists(kind: string, name: string): ExecResult {
  return err(`Error from server (AlreadyExists): ${kind.toLowerCase()}s "${name}" already exists`);
}

function dryRun(cmd: ParsedCommand): boolean {
  return flagStr(cmd, "--dry-run") === "client";
}

/** created-message or, with --dry-run=client -o yaml, the manifest. */
function finish(
  cmd: ParsedCommand,
  state: ClusterState,
  obj: Parameters<typeof toYaml>[0],
  fullName: string,
  commit: () => void,
): ExecResult {
  if (dryRun(cmd)) {
    if (flagStr(cmd, "--output") === "yaml") return ok(toYaml(obj).trimEnd());
    return ok(`${fullName}/${obj.metadata.name} created (dry run)`);
  }
  commit();
  return ok(`${fullName}/${obj.metadata.name} created`);
}

function parseSubjects(cmd: ParsedCommand): RbacSubject[] | ExecResult {
  const subjects: RbacSubject[] = [];
  const sa = flagStr(cmd, "--serviceaccount");
  if (sa) {
    const [ns, name] = sa.split(":");
    if (!name) return err("error: serviceaccount must be <namespace>:<name>");
    subjects.push({ kind: "ServiceAccount", name, namespace: ns });
  }
  const user = flagStr(cmd, "--user");
  if (user) subjects.push({ kind: "User", name: user });
  const group = flagStr(cmd, "--group");
  if (group) subjects.push({ kind: "Group", name: group });
  if (subjects.length === 0)
    return err("error: at least one of --user, --group or --serviceaccount is required");
  return subjects;
}

function parseRules(cmd: ParsedCommand): PolicyRule[] | ExecResult {
  const verbs = flagStr(cmd, "--verb");
  const resources = flagStr(cmd, "--resource");
  if (!verbs || !resources) return err("error: at least one verb and resource must be specified");
  const resourceNames = flagStr(cmd, "--resource-name");
  return [
    {
      apiGroups: resources.split(",").some((r) => r.startsWith("deployment") || r.startsWith("replicaset"))
        ? ["apps"]
        : [""],
      resources: resources.split(","),
      verbs: verbs.split(","),
      ...(resourceNames ? { resourceNames: resourceNames.split(",") } : {}),
    },
  ];
}

export function handleCreate(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const filename = flagStr(cmd, "--filename");
  if (filename) {
    if (filename !== "-") {
      return err(`error: the path "${filename}" does not exist (paste YAML with 'kubectl create -f -' instead)`);
    }
    return { output: "", exitCode: 0, editor: { mode: "apply", initialYaml: "" } };
  }

  const [sub, name] = cmd.args;
  const ns = resolveNamespace(cmd, state);

  switch (sub) {
    case "deployment":
    case "deploy": {
      if (!name) return err("error: NAME is required");
      const image = flagStr(cmd, "--image");
      if (!image) return err("error: --image is required");
      if (state.deployments.some((d) => d.metadata.name === name && d.metadata.namespace === ns))
        return alreadyExists("Deployment", name);
      const replicas = parseInt(flagStr(cmd, "--replicas") ?? "1", 10);
      const port = flagStr(cmd, "--port");
      const containerName = name;
      const dep: K8sDeployment = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name, namespace: ns, labels: { app: name }, creationTimestamp: SIM_TIMESTAMP },
        spec: {
          replicas,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: {
              containers: [
                {
                  name: containerName,
                  image,
                  ...(port ? { ports: [{ containerPort: parseInt(port, 10) }] } : {}),
                },
              ],
            },
          },
        },
        status: {},
        rolloutHistory: [{ revision: 1, image }],
      };
      return finish(cmd, state, dep, "deployment.apps", () => {
        state.deployments.push(dep);
        syncDeployment(state, dep);
      });
    }

    case "configmap":
    case "cm": {
      if (!name) return err("error: NAME is required");
      if (state.configmaps.some((c) => c.metadata.name === name && c.metadata.namespace === ns))
        return alreadyExists("ConfigMap", name);
      const data: Record<string, string> = {};
      for (const lit of cmd.repeated["--from-literal"] ?? []) {
        const eq = lit.indexOf("=");
        if (eq === -1) return err(`error: invalid literal "${lit}", expected key=value`);
        data[lit.slice(0, eq)] = lit.slice(eq + 1);
      }
      for (const f of cmd.repeated["--from-file"] ?? []) {
        const base = f.split("=")[0].split("/").pop() ?? f;
        data[base] = `<file content: ${f}>`;
      }
      const cmap: K8sConfigMap = {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name, namespace: ns, creationTimestamp: SIM_TIMESTAMP },
        data,
      };
      return finish(cmd, state, cmap, "configmap", () => state.configmaps.push(cmap));
    }

    case "secret": {
      const [kind, secretName] = [name, cmd.args[2]];
      if (kind !== "generic")
        return err(`error: only 'kubectl create secret generic' is supported here`);
      if (!secretName) return err("error: NAME is required");
      if (state.secrets.some((s) => s.metadata.name === secretName && s.metadata.namespace === ns))
        return alreadyExists("Secret", secretName);
      const data: Record<string, string> = {};
      for (const lit of cmd.repeated["--from-literal"] ?? []) {
        const eq = lit.indexOf("=");
        if (eq === -1) return err(`error: invalid literal "${lit}", expected key=value`);
        data[lit.slice(0, eq)] = btoa(lit.slice(eq + 1));
      }
      const secret: K8sSecret = {
        apiVersion: "v1",
        kind: "Secret",
        metadata: { name: secretName, namespace: ns, creationTimestamp: SIM_TIMESTAMP },
        type: "Opaque",
        data,
      };
      return finish(cmd, state, secret, "secret", () => state.secrets.push(secret));
    }

    case "namespace":
    case "ns": {
      if (!name) return err("error: NAME is required");
      if (state.namespaces.some((n) => n.metadata.name === name))
        return alreadyExists("Namespace", name);
      const nsObj: K8sNamespace = {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name, creationTimestamp: SIM_TIMESTAMP },
        status: { phase: "Active" },
      };
      return finish(cmd, state, nsObj, "namespace", () => state.namespaces.push(nsObj));
    }

    case "serviceaccount":
    case "sa": {
      if (!name) return err("error: NAME is required");
      if (state.serviceaccounts.some((s) => s.metadata.name === name && s.metadata.namespace === ns))
        return alreadyExists("ServiceAccount", name);
      const sa: K8sServiceAccount = {
        apiVersion: "v1",
        kind: "ServiceAccount",
        metadata: { name, namespace: ns, creationTimestamp: SIM_TIMESTAMP },
      };
      return finish(cmd, state, sa, "serviceaccount", () => state.serviceaccounts.push(sa));
    }

    case "role": {
      if (!name) return err("error: NAME is required");
      if (state.roles.some((r) => r.metadata.name === name && r.metadata.namespace === ns))
        return alreadyExists("Role", name);
      const rules = parseRules(cmd);
      if ("exitCode" in rules) return rules;
      const role: K8sRole = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        metadata: { name, namespace: ns, creationTimestamp: SIM_TIMESTAMP },
        rules,
      };
      return finish(cmd, state, role, "role.rbac.authorization.k8s.io", () =>
        state.roles.push(role),
      );
    }

    case "clusterrole": {
      if (!name) return err("error: NAME is required");
      if (state.clusterroles.some((r) => r.metadata.name === name))
        return alreadyExists("ClusterRole", name);
      const rules = parseRules(cmd);
      if ("exitCode" in rules) return rules;
      const role = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRole" as const,
        metadata: { name, creationTimestamp: SIM_TIMESTAMP },
        rules,
      };
      return finish(cmd, state, role, "clusterrole.rbac.authorization.k8s.io", () =>
        state.clusterroles.push(role),
      );
    }

    case "rolebinding": {
      if (!name) return err("error: NAME is required");
      if (state.rolebindings.some((b) => b.metadata.name === name && b.metadata.namespace === ns))
        return alreadyExists("RoleBinding", name);
      const roleName = flagStr(cmd, "--role");
      const clusterRoleName = flagStr(cmd, "--clusterrole");
      if (!roleName && !clusterRoleName) return err("error: exactly one of --role or --clusterrole is required");
      const subjects = parseSubjects(cmd);
      if ("exitCode" in subjects) return subjects;
      const binding = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding" as const,
        metadata: { name, namespace: ns, creationTimestamp: SIM_TIMESTAMP },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: (roleName ? "Role" : "ClusterRole") as "Role" | "ClusterRole",
          name: roleName ?? clusterRoleName!,
        },
        subjects,
      };
      return finish(cmd, state, binding, "rolebinding.rbac.authorization.k8s.io", () =>
        state.rolebindings.push(binding),
      );
    }

    case "clusterrolebinding": {
      if (!name) return err("error: NAME is required");
      if (state.clusterrolebindings.some((b) => b.metadata.name === name))
        return alreadyExists("ClusterRoleBinding", name);
      const clusterRoleName = flagStr(cmd, "--clusterrole");
      if (!clusterRoleName) return err("error: --clusterrole is required");
      const subjects = parseSubjects(cmd);
      if ("exitCode" in subjects) return subjects;
      const binding = {
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRoleBinding" as const,
        metadata: { name, creationTimestamp: SIM_TIMESTAMP },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "ClusterRole" as const,
          name: clusterRoleName,
        },
        subjects,
      };
      return finish(cmd, state, binding, "clusterrolebinding.rbac.authorization.k8s.io", () =>
        state.clusterrolebindings.push(binding),
      );
    }

    case "service": {
      const svcType = name; // clusterip | nodeport
      const svcName = cmd.args[2];
      if (svcType !== "clusterip" && svcType !== "nodeport")
        return err("error: supported: kubectl create service clusterip|nodeport NAME --tcp=port:targetPort");
      if (!svcName) return err("error: NAME is required");
      const tcp = flagStr(cmd, "--tcp") ?? "80";
      const [portStr, targetStr] = tcp.split(":");
      const svc = {
        apiVersion: "v1",
        kind: "Service" as const,
        metadata: { name: svcName, namespace: ns, labels: { app: svcName }, creationTimestamp: SIM_TIMESTAMP },
        spec: {
          type: (svcType === "nodeport" ? "NodePort" : "ClusterIP") as "NodePort" | "ClusterIP",
          selector: { app: svcName },
          clusterIP: `10.96.${(svcName.length * 13) % 250}.${(svcName.length * 41) % 250}`,
          ports: [
            {
              port: parseInt(portStr, 10),
              targetPort: targetStr ? parseInt(targetStr, 10) : parseInt(portStr, 10),
              protocol: "TCP" as const,
              ...(svcType === "nodeport" ? { nodePort: 30000 + ((svcName.length * 977) % 2767) } : {}),
            },
          ],
        },
      };
      return finish(cmd, state, svc, "service", () => state.services.push(svc));
    }

    default:
      return err(
        `error: unknown command "${sub ?? ""}"\nSupported: deployment, configmap, secret generic, service clusterip|nodeport, namespace, serviceaccount, role, clusterrole, rolebinding, clusterrolebinding, -f -`,
      );
  }
}

export { applyYamlText };
