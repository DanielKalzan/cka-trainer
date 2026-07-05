import type { ClusterState } from "./cluster-state";

/** Keys of ClusterState that hold lists of API objects. */
export type ResourceKey =
  | "nodes"
  | "namespaces"
  | "pods"
  | "deployments"
  | "replicasets"
  | "services"
  | "configmaps"
  | "secrets"
  | "persistentvolumes"
  | "persistentvolumeclaims"
  | "storageclasses"
  | "networkpolicies"
  | "roles"
  | "rolebindings"
  | "clusterroles"
  | "clusterrolebindings"
  | "serviceaccounts";

export interface ResourceInfo {
  key: ResourceKey;
  kind: string;
  apiVersion: string;
  namespaced: boolean;
  /** Name printed in `kubectl get` result lines, e.g. deployment.apps/web */
  fullName: string;
}

const R = (
  key: ResourceKey,
  kind: string,
  apiVersion: string,
  namespaced: boolean,
  fullName: string,
): ResourceInfo => ({ key, kind, apiVersion, namespaced, fullName });

export const RESOURCES: Record<string, ResourceInfo> = {};

function register(info: ResourceInfo, aliases: string[]) {
  for (const a of aliases) RESOURCES[a] = info;
}

register(R("pods", "Pod", "v1", true, "pod"), ["pod", "pods", "po"]);
register(R("nodes", "Node", "v1", false, "node"), ["node", "nodes", "no"]);
register(R("namespaces", "Namespace", "v1", false, "namespace"), [
  "namespace",
  "namespaces",
  "ns",
]);
register(R("deployments", "Deployment", "apps/v1", true, "deployment.apps"), [
  "deployment",
  "deployments",
  "deploy",
]);
register(R("replicasets", "ReplicaSet", "apps/v1", true, "replicaset.apps"), [
  "replicaset",
  "replicasets",
  "rs",
]);
register(R("services", "Service", "v1", true, "service"), ["service", "services", "svc"]);
register(R("configmaps", "ConfigMap", "v1", true, "configmap"), [
  "configmap",
  "configmaps",
  "cm",
]);
register(R("secrets", "Secret", "v1", true, "secret"), ["secret", "secrets"]);
register(R("persistentvolumes", "PersistentVolume", "v1", false, "persistentvolume"), [
  "persistentvolume",
  "persistentvolumes",
  "pv",
]);
register(
  R("persistentvolumeclaims", "PersistentVolumeClaim", "v1", true, "persistentvolumeclaim"),
  ["persistentvolumeclaim", "persistentvolumeclaims", "pvc"],
);
register(
  R("storageclasses", "StorageClass", "storage.k8s.io/v1", false, "storageclass.storage.k8s.io"),
  ["storageclass", "storageclasses", "sc"],
);
register(
  R(
    "networkpolicies",
    "NetworkPolicy",
    "networking.k8s.io/v1",
    true,
    "networkpolicy.networking.k8s.io",
  ),
  ["networkpolicy", "networkpolicies", "netpol"],
);
register(
  R("roles", "Role", "rbac.authorization.k8s.io/v1", true, "role.rbac.authorization.k8s.io"),
  ["role", "roles"],
);
register(
  R(
    "rolebindings",
    "RoleBinding",
    "rbac.authorization.k8s.io/v1",
    true,
    "rolebinding.rbac.authorization.k8s.io",
  ),
  ["rolebinding", "rolebindings"],
);
register(
  R(
    "clusterroles",
    "ClusterRole",
    "rbac.authorization.k8s.io/v1",
    false,
    "clusterrole.rbac.authorization.k8s.io",
  ),
  ["clusterrole", "clusterroles"],
);
register(
  R(
    "clusterrolebindings",
    "ClusterRoleBinding",
    "rbac.authorization.k8s.io/v1",
    false,
    "clusterrolebinding.rbac.authorization.k8s.io",
  ),
  ["clusterrolebinding", "clusterrolebindings"],
);
register(R("serviceaccounts", "ServiceAccount", "v1", true, "serviceaccount"), [
  "serviceaccount",
  "serviceaccounts",
  "sa",
]);

export function lookupResource(token: string): ResourceInfo | undefined {
  return RESOURCES[token.toLowerCase()];
}

export function lookupResourceByKind(kind: string): ResourceInfo | undefined {
  return Object.values(RESOURCES).find((r) => r.kind.toLowerCase() === kind.toLowerCase());
}

export function getList(state: ClusterState, info: ResourceInfo) {
  return state[info.key] as { metadata: { name: string; namespace?: string } }[];
}
