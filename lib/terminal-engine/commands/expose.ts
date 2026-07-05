import type { ClusterState, K8sService } from "../cluster-state";
import { flagStr, type ParsedCommand } from "../parser";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  SIM_TIMESTAMP,
  toYaml,
  type ExecResult,
} from "./helpers";

export function handleExpose(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  const { info, name } = parsed;
  if (!name) return err("error: you must specify the name of the resource to expose");
  const ns = resolveNamespace(cmd, state);

  let selector: Record<string, string> | undefined;
  let defaultTargetPort: number | undefined;
  if (info.key === "deployments") {
    const dep = state.deployments.find(
      (d) => d.metadata.name === name && (d.metadata.namespace ?? "default") === ns,
    );
    if (!dep) return notFoundError(info, name, ns);
    selector = dep.spec.selector.matchLabels;
    defaultTargetPort = dep.spec.template.spec.containers[0]?.ports?.[0]?.containerPort;
  } else if (info.key === "pods") {
    const pod = state.pods.find(
      (p) => p.metadata.name === name && (p.metadata.namespace ?? "default") === ns,
    );
    if (!pod) return notFoundError(info, name, ns);
    selector = pod.metadata.labels;
    defaultTargetPort = pod.spec.containers[0]?.ports?.[0]?.containerPort;
  } else {
    return err(`error: cannot expose a ${info.kind}`);
  }

  const portStr = flagStr(cmd, "--port");
  if (!portStr) return err("error: couldn't find port via --port flag or introspection");
  const port = parseInt(portStr, 10);
  const targetPortStr = flagStr(cmd, "--target-port");
  const svcName = flagStr(cmd, "--name") ?? name;
  const svcType = (flagStr(cmd, "--type") ?? "ClusterIP") as NonNullable<K8sService["spec"]["type"]>;

  if (state.services.some((s) => s.metadata.name === svcName && (s.metadata.namespace ?? "default") === ns)) {
    return err(`Error from server (AlreadyExists): services "${svcName}" already exists`);
  }

  const svc: K8sService = {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: svcName, namespace: ns, labels: selector, creationTimestamp: SIM_TIMESTAMP },
    spec: {
      type: svcType,
      selector,
      clusterIP: `10.96.${(svcName.length * 13) % 250}.${(svcName.length * 41) % 250}`,
      ports: [
        {
          port,
          targetPort: targetPortStr
            ? Number.isNaN(parseInt(targetPortStr, 10))
              ? targetPortStr
              : parseInt(targetPortStr, 10)
            : (defaultTargetPort ?? port),
          protocol: (flagStr(cmd, "--protocol") as "TCP" | "UDP") ?? "TCP",
          ...(svcType === "NodePort" ? { nodePort: 30000 + ((svcName.length * 977) % 2767) } : {}),
        },
      ],
    },
  };

  if (flagStr(cmd, "--dry-run") === "client") {
    if (flagStr(cmd, "--output") === "yaml") return ok(toYaml(svc).trimEnd());
    return ok(`service/${svcName} exposed (dry run)`);
  }
  state.services.push(svc);
  return ok(`service/${svcName} exposed`);
}
