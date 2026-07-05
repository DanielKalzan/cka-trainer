import type { ClusterState, K8sDeployment, K8sNode, K8sPod, K8sService } from "../cluster-state";
import { formatAge, formatLabels } from "../format";
import type { ParsedCommand } from "../parser";
import { getList } from "../resources";
import {
  err,
  notFoundError,
  ok,
  parseTypeName,
  resolveNamespace,
  selectorToString,
  toYaml,
  type ExecResult,
} from "./helpers";

function eventLines(state: ClusterState, kind: string, name: string): string {
  const relevant = state.events.filter((e) => e.involvedObject === `${kind}/${name}`);
  if (relevant.length === 0) return "Events:          <none>";
  const lines = relevant.map(
    (e) =>
      `  ${e.type.padEnd(9)}${e.reason.padEnd(25)}${e.age.padEnd(8)}${e.source ?? "kubelet"}${" ".repeat(2)}${e.message}`,
  );
  return `Events:\n  Type     Reason                   Age     From  Message\n  ----     ------                   ----    ----  -------\n${lines.join("\n")}`;
}

function describePod(state: ClusterState, pod: K8sPod): string {
  const lines: string[] = [
    `Name:             ${pod.metadata.name}`,
    `Namespace:        ${pod.metadata.namespace ?? "default"}`,
    `Node:             ${pod.spec.nodeName ? `${pod.spec.nodeName}/172.30.1.2` : "<none>"}`,
    `Start Time:       ${pod.metadata.creationTimestamp ?? "<unknown>"}`,
    `Labels:           ${formatLabels(pod.metadata.labels)}`,
    `Annotations:      ${formatLabels(pod.metadata.annotations)}`,
    `Status:           ${pod.status.phase}`,
    `IP:               ${pod.status.podIP ?? "<none>"}`,
  ];
  if (pod.spec.serviceAccountName) lines.push(`Service Account:  ${pod.spec.serviceAccountName}`);
  lines.push("Containers:");
  for (const c of pod.spec.containers) {
    const st = pod.status.containerStatuses?.find((s) => s.name === c.name);
    lines.push(`  ${c.name}:`);
    lines.push(`    Image:          ${c.image}`);
    if (c.command) lines.push(`    Command:        ${JSON.stringify(c.command)}`);
    if (c.ports?.length)
      lines.push(`    Port(s):        ${c.ports.map((p) => `${p.containerPort}/TCP`).join(", ")}`);
    lines.push(`    State:          ${st?.state ?? "Unknown"}`);
    if (st?.stateMessage) lines.push(`      Message:      ${st.stateMessage}`);
    lines.push(`    Ready:          ${st?.ready ?? false}`);
    lines.push(`    Restart Count:  ${st?.restartCount ?? 0}`);
    if (c.resources?.requests)
      lines.push(
        `    Requests:       ${Object.entries(c.resources.requests)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      );
    if (c.resources?.limits)
      lines.push(
        `    Limits:         ${Object.entries(c.resources.limits)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      );
    if (c.volumeMounts?.length) {
      lines.push(`    Mounts:`);
      for (const m of c.volumeMounts) lines.push(`      ${m.mountPath} from ${m.name}`);
    }
  }
  if (pod.spec.volumes?.length) {
    lines.push("Volumes:");
    for (const v of pod.spec.volumes) {
      const kind = v.configMap
        ? `ConfigMap (name: ${v.configMap.name})`
        : v.secret
          ? `Secret (name: ${v.secret.secretName})`
          : v.persistentVolumeClaim
            ? `PersistentVolumeClaim (claim: ${v.persistentVolumeClaim.claimName})`
            : v.hostPath
              ? `HostPath (path: ${v.hostPath.path})`
              : "EmptyDir";
      lines.push(`  ${v.name}:  ${kind}`);
    }
  }
  if (pod.spec.nodeSelector)
    lines.push(`Node-Selectors:   ${formatLabels(pod.spec.nodeSelector)}`);
  if (pod.spec.tolerations?.length)
    lines.push(
      `Tolerations:      ${pod.spec.tolerations
        .map((t) => `${t.key ?? ""}${t.value ? `=${t.value}` : ""}:${t.effect ?? ""}`)
        .join(", ")}`,
    );
  lines.push(eventLines(state, "Pod", pod.metadata.name));
  return lines.join("\n");
}

function describeNode(state: ClusterState, node: K8sNode): string {
  const ready = node.status.conditions.find((c) => c.type === "Ready");
  const lines = [
    `Name:               ${node.metadata.name}`,
    `Roles:              ${node.roles?.join(",") || "<none>"}`,
    `Labels:             ${formatLabels(node.metadata.labels)}`,
    `Unschedulable:      ${node.spec.unschedulable ?? false}`,
    `Taints:             ${
      node.spec.taints?.map((t) => `${t.key}${t.value ? `=${t.value}` : ""}:${t.effect}`).join(", ") ?? "<none>"
    }`,
    `Conditions:`,
    `  Type    Status  Reason`,
    `  ----    ------  ------`,
    ...node.status.conditions.map(
      (c) => `  ${c.type.padEnd(8)}${c.status.padEnd(8)}${c.reason ?? ""}${c.message ? ` (${c.message})` : ""}`,
    ),
    `System Info:`,
    `  Kubelet Version:            ${node.status.nodeInfo.kubeletVersion}`,
    `  Container Runtime Version:  ${node.status.nodeInfo.containerRuntimeVersion}`,
    `  OS Image:                   ${node.status.nodeInfo.osImage}`,
  ];
  const podsHere = state.pods.filter((p) => p.spec.nodeName === node.metadata.name);
  lines.push(`Non-terminated Pods:          (${podsHere.length} in total)`);
  for (const p of podsHere)
    lines.push(`  ${(p.metadata.namespace ?? "default").padEnd(14)}${p.metadata.name}`);
  if (ready?.status !== "True" && ready?.message) {
    lines.push(`Ready condition message:      ${ready.message}`);
  }
  lines.push(eventLines(state, "Node", node.metadata.name));
  return lines.join("\n");
}

function describeDeployment(state: ClusterState, dep: K8sDeployment): string {
  return [
    `Name:                   ${dep.metadata.name}`,
    `Namespace:              ${dep.metadata.namespace ?? "default"}`,
    `CreationTimestamp:      ${dep.metadata.creationTimestamp ?? "<unknown>"}`,
    `Labels:                 ${formatLabels(dep.metadata.labels)}`,
    `Selector:               ${selectorToString(dep.spec.selector.matchLabels)}`,
    `Replicas:               ${dep.spec.replicas} desired | ${dep.status.updatedReplicas ?? 0} updated | ${dep.status.replicas ?? 0} total | ${dep.status.availableReplicas ?? 0} available | ${dep.status.unavailableReplicas ?? 0} unavailable`,
    `StrategyType:           ${dep.spec.strategy?.type ?? "RollingUpdate"}`,
    `Pod Template:`,
    `  Labels:  ${formatLabels(dep.spec.template.metadata.labels)}`,
    `  Containers:`,
    ...dep.spec.template.spec.containers.flatMap((c) => [
      `   ${c.name}:`,
      `    Image:  ${c.image}`,
      ...(c.ports?.length ? [`    Port:   ${c.ports.map((p) => `${p.containerPort}/TCP`).join(", ")}`] : []),
    ]),
    eventLines(state, "Deployment", dep.metadata.name),
  ].join("\n");
}

function describeService(state: ClusterState, svc: K8sService): string {
  const selector = svc.spec.selector;
  const matchingPods = selector
    ? state.pods.filter(
        (p) =>
          (p.metadata.namespace ?? "default") === (svc.metadata.namespace ?? "default") &&
          Object.entries(selector).every(([k, v]) => p.metadata.labels?.[k] === v) &&
          p.status.phase === "Running",
      )
    : [];
  const endpoints =
    matchingPods.length > 0
      ? matchingPods
          .map((p) => `${p.status.podIP}:${svc.spec.ports[0]?.targetPort ?? svc.spec.ports[0]?.port}`)
          .join(",")
      : "<none>";
  return [
    `Name:              ${svc.metadata.name}`,
    `Namespace:         ${svc.metadata.namespace ?? "default"}`,
    `Labels:            ${formatLabels(svc.metadata.labels)}`,
    `Selector:          ${selector ? formatLabels(selector) : "<none>"}`,
    `Type:              ${svc.spec.type ?? "ClusterIP"}`,
    `IP:                ${svc.spec.clusterIP ?? "<none>"}`,
    ...svc.spec.ports.map(
      (p) =>
        `Port:              ${p.name ?? "<unset>"}  ${p.port}/${p.protocol ?? "TCP"}\nTargetPort:        ${p.targetPort ?? p.port}/${p.protocol ?? "TCP"}${
          p.nodePort ? `\nNodePort:          ${p.name ?? "<unset>"}  ${p.nodePort}/${p.protocol ?? "TCP"}` : ""
        }`,
    ),
    `Endpoints:         ${endpoints}`,
    eventLines(state, "Service", svc.metadata.name),
  ].join("\n");
}

export function handleDescribe(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const parsed = parseTypeName(cmd.args);
  if (!parsed) {
    return err(`error: the server doesn't have a resource type "${cmd.args[0] ?? ""}"`);
  }
  const { info, name } = parsed;
  if (!name) return err("error: you must specify the name of the resource to describe");

  const ns = resolveNamespace(cmd, state);
  const list = getList(state, info);
  const obj = list.find(
    (o) => o.metadata.name === name && (!info.namespaced || (o.metadata.namespace ?? "default") === ns),
  );
  if (!obj) return notFoundError(info, name, ns);

  switch (info.key) {
    case "pods":
      return ok(describePod(state, obj as K8sPod));
    case "nodes":
      return ok(describeNode(state, obj as K8sNode));
    case "deployments":
      return ok(describeDeployment(state, obj as K8sDeployment));
    case "services":
      return ok(describeService(state, obj as K8sService));
    default: {
      // Generic describe: labels + full object dump
      const o = obj as { metadata: { name: string; namespace?: string; labels?: Record<string, string> } };
      return ok(
        [
          `Name:         ${o.metadata.name}`,
          ...(info.namespaced ? [`Namespace:    ${o.metadata.namespace ?? "default"}`] : []),
          `Labels:       ${formatLabels(o.metadata.labels)}`,
          `Age:          ${formatAge((obj as { metadata: { creationTimestamp?: string } }).metadata.creationTimestamp)}`,
          ``,
          toYaml(obj as never).trimEnd(),
        ].join("\n"),
      );
    }
  }
}
