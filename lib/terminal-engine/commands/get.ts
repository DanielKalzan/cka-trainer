import type {
  ClusterState,
  K8sDeployment,
  K8sNode,
  K8sObject,
  K8sPersistentVolume,
  K8sPersistentVolumeClaim,
  K8sPod,
  K8sReplicaSet,
  K8sService,
} from "../cluster-state";
import { formatAge, formatLabels, formatTable } from "../format";
import { flagBool, flagStr, type ParsedCommand } from "../parser";
import { getList, lookupResource, type ResourceInfo } from "../resources";
import { err, matchesSelector, ok, resolveNamespace, toYaml, type ExecResult } from "./helpers";

export function podStatus(pod: K8sPod): string {
  if (pod.status.reason) return pod.status.reason;
  const bad = pod.status.containerStatuses?.find(
    (c) => c.state !== "Running" && c.state !== "Completed",
  );
  if (bad) return bad.state;
  if (pod.status.phase === "Succeeded") return "Completed";
  return pod.status.phase;
}

function podRow(pod: K8sPod, wide: boolean): string[] {
  const statuses = pod.status.containerStatuses ?? [];
  const ready = `${statuses.filter((c) => c.ready).length}/${pod.spec.containers.length}`;
  const restarts = statuses.reduce((sum, c) => sum + c.restartCount, 0).toString();
  const base = [pod.metadata.name, ready, podStatus(pod), restarts, formatAge(pod.metadata.creationTimestamp)];
  if (wide) base.push(pod.status.podIP ?? "<none>", pod.spec.nodeName ?? "<none>");
  return base;
}

function nodeRow(node: K8sNode): string[] {
  const ready = node.status.conditions.find((c) => c.type === "Ready");
  let status = ready?.status === "True" ? "Ready" : "NotReady";
  if (node.spec.unschedulable) status += ",SchedulingDisabled";
  const roles = node.roles && node.roles.length > 0 ? node.roles.join(",") : "<none>";
  return [
    node.metadata.name,
    status,
    roles,
    formatAge(node.metadata.creationTimestamp),
    node.status.nodeInfo.kubeletVersion,
  ];
}

function serviceRow(svc: K8sService): string[] {
  const ports = svc.spec.ports
    .map((p) => {
      const proto = p.protocol ?? "TCP";
      return svc.spec.type === "NodePort" && p.nodePort
        ? `${p.port}:${p.nodePort}/${proto}`
        : `${p.port}/${proto}`;
    })
    .join(",");
  return [
    svc.metadata.name,
    svc.spec.type ?? "ClusterIP",
    svc.spec.clusterIP ?? "<none>",
    "<none>",
    ports,
    formatAge(svc.metadata.creationTimestamp),
  ];
}

interface ColumnSpec {
  headers: string[];
  wideHeaders?: string[];
  row: (obj: never, wide: boolean) => string[];
}

const COLUMNS: Partial<Record<string, ColumnSpec>> = {
  pods: {
    headers: ["NAME", "READY", "STATUS", "RESTARTS", "AGE"],
    wideHeaders: ["NAME", "READY", "STATUS", "RESTARTS", "AGE", "IP", "NODE"],
    row: (p: K8sPod, wide) => podRow(p, wide),
  },
  nodes: {
    headers: ["NAME", "STATUS", "ROLES", "AGE", "VERSION"],
    row: (n: K8sNode) => nodeRow(n),
  },
  deployments: {
    headers: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"],
    row: (d: K8sDeployment) => [
      d.metadata.name,
      `${d.status.readyReplicas ?? 0}/${d.spec.replicas}`,
      `${d.status.updatedReplicas ?? d.status.readyReplicas ?? 0}`,
      `${d.status.availableReplicas ?? 0}`,
      formatAge(d.metadata.creationTimestamp),
    ],
  },
  replicasets: {
    headers: ["NAME", "DESIRED", "CURRENT", "READY", "AGE"],
    row: (r: K8sReplicaSet) => [
      r.metadata.name,
      `${r.spec.replicas}`,
      `${r.status.replicas ?? 0}`,
      `${r.status.readyReplicas ?? 0}`,
      formatAge(r.metadata.creationTimestamp),
    ],
  },
  services: {
    headers: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"],
    row: (s: K8sService) => serviceRow(s),
  },
  configmaps: {
    headers: ["NAME", "DATA", "AGE"],
    row: (c: { metadata: { name: string; creationTimestamp?: string }; data?: Record<string, string> }) => [
      c.metadata.name,
      `${Object.keys(c.data ?? {}).length}`,
      formatAge(c.metadata.creationTimestamp),
    ],
  },
  secrets: {
    headers: ["NAME", "TYPE", "DATA", "AGE"],
    row: (s: { metadata: { name: string; creationTimestamp?: string }; type?: string; data?: Record<string, string> }) => [
      s.metadata.name,
      s.type ?? "Opaque",
      `${Object.keys(s.data ?? {}).length}`,
      formatAge(s.metadata.creationTimestamp),
    ],
  },
  persistentvolumes: {
    headers: ["NAME", "CAPACITY", "ACCESS MODES", "RECLAIM POLICY", "STATUS", "CLAIM", "STORAGECLASS", "AGE"],
    row: (pv: K8sPersistentVolume) => [
      pv.metadata.name,
      pv.spec.capacity.storage,
      pv.spec.accessModes.map(shortAccessMode).join(","),
      pv.spec.persistentVolumeReclaimPolicy ?? "Retain",
      pv.status.phase,
      pv.status.claimRef ?? "",
      pv.spec.storageClassName ?? "",
      formatAge(pv.metadata.creationTimestamp),
    ],
  },
  persistentvolumeclaims: {
    headers: ["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "AGE"],
    row: (pvc: K8sPersistentVolumeClaim) => [
      pvc.metadata.name,
      pvc.status.phase,
      pvc.spec.volumeName ?? "",
      pvc.status.capacity?.storage ?? "",
      pvc.spec.accessModes.map(shortAccessMode).join(","),
      pvc.spec.storageClassName ?? "",
      formatAge(pvc.metadata.creationTimestamp),
    ],
  },
  storageclasses: {
    headers: ["NAME", "PROVISIONER", "RECLAIMPOLICY", "VOLUMEBINDINGMODE", "AGE"],
    row: (sc: { metadata: { name: string; creationTimestamp?: string }; provisioner: string; reclaimPolicy?: string; volumeBindingMode?: string }) => [
      sc.metadata.name,
      sc.provisioner,
      sc.reclaimPolicy ?? "Delete",
      sc.volumeBindingMode ?? "Immediate",
      formatAge(sc.metadata.creationTimestamp),
    ],
  },
  networkpolicies: {
    headers: ["NAME", "POD-SELECTOR", "AGE"],
    row: (np: { metadata: { name: string; creationTimestamp?: string }; spec: { podSelector: { matchLabels?: Record<string, string> } } }) => [
      np.metadata.name,
      formatLabels(np.spec.podSelector.matchLabels),
      formatAge(np.metadata.creationTimestamp),
    ],
  },
  namespaces: {
    headers: ["NAME", "STATUS", "AGE"],
    row: (ns: { metadata: { name: string; creationTimestamp?: string }; status: { phase: string } }) => [
      ns.metadata.name,
      ns.status.phase,
      formatAge(ns.metadata.creationTimestamp),
    ],
  },
  serviceaccounts: {
    headers: ["NAME", "SECRETS", "AGE"],
    row: (sa: { metadata: { name: string; creationTimestamp?: string } }) => [
      sa.metadata.name,
      "0",
      formatAge(sa.metadata.creationTimestamp),
    ],
  },
  roles: {
    headers: ["NAME", "CREATED AT"],
    row: (r: { metadata: { name: string; creationTimestamp?: string } }) => [
      r.metadata.name,
      r.metadata.creationTimestamp ?? "",
    ],
  },
  clusterroles: {
    headers: ["NAME", "CREATED AT"],
    row: (r: { metadata: { name: string; creationTimestamp?: string } }) => [
      r.metadata.name,
      r.metadata.creationTimestamp ?? "",
    ],
  },
  rolebindings: {
    headers: ["NAME", "ROLE", "AGE"],
    row: (b: { metadata: { name: string; creationTimestamp?: string }; roleRef: { kind: string; name: string } }) => [
      b.metadata.name,
      `${b.roleRef.kind}/${b.roleRef.name}`,
      formatAge(b.metadata.creationTimestamp),
    ],
  },
  clusterrolebindings: {
    headers: ["NAME", "ROLE", "AGE"],
    row: (b: { metadata: { name: string; creationTimestamp?: string }; roleRef: { kind: string; name: string } }) => [
      b.metadata.name,
      `${b.roleRef.kind}/${b.roleRef.name}`,
      formatAge(b.metadata.creationTimestamp),
    ],
  },
};

function shortAccessMode(m: string): string {
  return (
    { ReadWriteOnce: "RWO", ReadOnlyMany: "ROX", ReadWriteMany: "RWX", ReadWriteOncePod: "RWOP" }[m] ?? m
  );
}

function getEvents(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const ns = resolveNamespace(cmd, state);
  const all = flagBool(cmd, "-A") || flagBool(cmd, "--all-namespaces");
  const events = state.events.filter((e) => all || e.namespace === ns);
  if (events.length === 0) return ok(`No resources found in ${ns} namespace.`);
  const rows = events.map((e) => [e.age, e.type, e.reason, e.involvedObject, e.message]);
  return ok(formatTable(["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], rows));
}

export function handleGet(state: ClusterState, cmd: ParsedCommand): ExecResult {
  const [typeToken, ...nameArgs] = cmd.args;
  if (!typeToken) {
    return err(
      "error: Required resource not specified.\nUse \"kubectl explain <resource>\" for a detailed description of that resource.",
    );
  }

  if (typeToken === "events" || typeToken === "ev" || typeToken === "event") {
    return getEvents(state, cmd);
  }

  // type/name form
  let names = nameArgs;
  let info: ResourceInfo | undefined;
  if (typeToken.includes("/")) {
    const [t, n] = typeToken.split("/");
    info = lookupResource(t);
    names = [n, ...nameArgs];
  } else {
    info = lookupResource(typeToken);
  }
  if (!info) {
    return err(`error: the server doesn't have a resource type "${typeToken.split("/")[0]}"`);
  }

  const ns = resolveNamespace(cmd, state);
  const allNamespaces = flagBool(cmd, "-A") || flagBool(cmd, "--all-namespaces");
  const selector = flagStr(cmd, "--selector");
  const output = flagStr(cmd, "--output");
  const wide = output === "wide";

  let items = getList(state, info) as (K8sObject & Record<string, unknown>)[];
  if (info.namespaced && !allNamespaces) {
    items = items.filter((o) => (o.metadata.namespace ?? "default") === ns);
  }
  if (selector) {
    items = items.filter((o) => matchesSelector(o.metadata.labels, selector));
  }
  if (names.length > 0) {
    const missing = names.filter((n) => !items.some((o) => o.metadata.name === n));
    if (missing.length > 0) {
      const scope = info.namespaced ? ` in namespace "${ns}"` : "";
      return err(
        missing
          .map((n) => `Error from server (NotFound): ${info.fullName.split(".")[0]}s "${n}" not found${scope}`)
          .join("\n"),
      );
    }
    items = items.filter((o) => names.includes(o.metadata.name));
  }

  if (output === "yaml") {
    if (items.length === 1) return ok(toYaml(items[0]).trimEnd());
    return ok(
      `apiVersion: v1\nitems:\n${items
        .map((o) =>
          toYaml(o)
            .trimEnd()
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n"),
        )
        .map((y) => `- ${y.slice(2)}`)
        .join("\n")}\nkind: List`,
    );
  }
  if (output === "name") {
    return ok(items.map((o) => `${info.fullName}/${o.metadata.name}`).join("\n"));
  }
  if (output !== undefined && !wide) {
    return err(`error: unable to match a printer suitable for the output format "${output}"`);
  }

  if (items.length === 0) {
    if (!info.namespaced || allNamespaces) return ok("No resources found");
    return ok(`No resources found in ${ns} namespace.`);
  }

  const spec = COLUMNS[info.key];
  if (!spec) return ok(items.map((o) => o.metadata.name).join("\n"));

  let headers = wide && spec.wideHeaders ? spec.wideHeaders : spec.headers;
  let rows = items.map((o) => spec.row(o as never, wide));
  if (info.namespaced && allNamespaces) {
    headers = ["NAMESPACE", ...headers];
    rows = items.map((o, i) => [o.metadata.namespace ?? "default", ...rows[i]]);
  }
  if (flagBool(cmd, "--show-labels")) {
    headers = [...headers, "LABELS"];
    rows = rows.map((r, i) => [...r, formatLabels(items[i].metadata.labels)]);
  }
  return ok(formatTable(headers, rows));
}
