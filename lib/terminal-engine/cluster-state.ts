/**
 * Simplified in-memory Kubernetes cluster model.
 *
 * Shapes stay close to real API objects (apiVersion/kind/metadata/spec/status)
 * so pasted YAML maps naturally onto this state. Exercises provide an initial
 * ClusterState fixture; command handlers (Phase 3) mutate a copy of it and
 * checkers grade the resulting state.
 */

export interface ObjectMeta {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  uid?: string;
}

export interface K8sObject {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface NodeCondition {
  type: "Ready" | "MemoryPressure" | "DiskPressure" | "PIDPressure";
  status: "True" | "False" | "Unknown";
  reason?: string;
  message?: string;
}

export interface Taint {
  key: string;
  value?: string;
  effect: "NoSchedule" | "PreferNoSchedule" | "NoExecute";
}

export interface K8sNode extends K8sObject {
  kind: "Node";
  spec: {
    taints?: Taint[];
    unschedulable?: boolean;
    podCIDR?: string;
  };
  status: {
    conditions: NodeCondition[];
    nodeInfo: {
      kubeletVersion: string;
      containerRuntimeVersion: string;
      osImage: string;
      kernelVersion?: string;
    };
    capacity?: { cpu: string; memory: string; pods?: string };
    addresses?: { type: "InternalIP" | "Hostname"; address: string }[];
  };
  /** Simulator-only: role shown in `kubectl get nodes` (control-plane / <none>). */
  roles?: string[];
}

// ---------------------------------------------------------------------------
// Workloads
// ---------------------------------------------------------------------------

export interface Container {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  ports?: { containerPort: number; name?: string; protocol?: string }[];
  env?: { name: string; value?: string; valueFrom?: unknown }[];
  envFrom?: unknown[];
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
  volumeMounts?: { name: string; mountPath: string; readOnly?: boolean }[];
  livenessProbe?: unknown;
  readinessProbe?: unknown;
}

export interface PodVolume {
  name: string;
  configMap?: { name: string; items?: unknown[] };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
  emptyDir?: Record<string, never> | { medium?: string };
  hostPath?: { path: string; type?: string };
}

export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  /** e.g. "Running", "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "Completed", "ContainerCreating", "OOMKilled", "Pending" */
  state: string;
  /** Human-readable detail shown in describe/events. */
  stateMessage?: string;
}

export interface PodSpec {
  containers: Container[];
  initContainers?: Container[];
  volumes?: PodVolume[];
  nodeName?: string;
  nodeSelector?: Record<string, string>;
  serviceAccountName?: string;
  tolerations?: { key?: string; operator?: string; value?: string; effect?: string }[];
  affinity?: unknown;
  restartPolicy?: "Always" | "OnFailure" | "Never";
  priorityClassName?: string;
  hostNetwork?: boolean;
  dnsPolicy?: string;
  schedulerName?: string;
}

export interface K8sPod extends K8sObject {
  kind: "Pod";
  spec: PodSpec;
  status: {
    phase: PodPhase;
    podIP?: string;
    hostIP?: string;
    containerStatuses?: ContainerStatus[];
    conditions?: { type: string; status: string; reason?: string }[];
    reason?: string;
    message?: string;
    startTime?: string;
  };
  /** Simulator-only: mocked `kubectl logs` output per container name ("" key = single container). */
  mockLogs?: Record<string, string>;
  /** Simulator-only: mocked `kubectl exec` responses keyed by command string. */
  mockExec?: Record<string, string>;
}

export interface K8sDeployment extends K8sObject {
  kind: "Deployment";
  spec: {
    replicas: number;
    selector: { matchLabels: Record<string, string> };
    strategy?: { type?: "RollingUpdate" | "Recreate"; rollingUpdate?: unknown };
    template: {
      metadata: { labels: Record<string, string>; annotations?: Record<string, string> };
      spec: PodSpec;
    };
  };
  status: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    updatedReplicas?: number;
    unavailableReplicas?: number;
    observedGeneration?: number;
  };
  /** Simulator-only: rollout history, newest last. */
  rolloutHistory?: { revision: number; changeCause?: string; image: string }[];
}

export interface K8sReplicaSet extends K8sObject {
  kind: "ReplicaSet";
  spec: {
    replicas: number;
    selector: { matchLabels: Record<string, string> };
    template: { metadata: { labels: Record<string, string> }; spec: PodSpec };
  };
  status: { replicas?: number; readyReplicas?: number };
  /** Owner deployment name (simulator shortcut for ownerReferences). */
  ownerDeployment?: string;
}

// ---------------------------------------------------------------------------
// Services & networking
// ---------------------------------------------------------------------------

export interface ServicePort {
  name?: string;
  port: number;
  targetPort?: number | string;
  nodePort?: number;
  protocol?: "TCP" | "UDP";
}

export interface K8sService extends K8sObject {
  kind: "Service";
  spec: {
    type?: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
    selector?: Record<string, string>;
    ports: ServicePort[];
    clusterIP?: string;
    externalName?: string;
  };
  status?: Record<string, unknown>;
}

export interface K8sNetworkPolicy extends K8sObject {
  kind: "NetworkPolicy";
  spec: {
    podSelector: { matchLabels?: Record<string, string> };
    policyTypes?: ("Ingress" | "Egress")[];
    ingress?: unknown[];
    egress?: unknown[];
  };
}

// ---------------------------------------------------------------------------
// Config & storage
// ---------------------------------------------------------------------------

export interface K8sConfigMap extends K8sObject {
  kind: "ConfigMap";
  data?: Record<string, string>;
}

export interface K8sSecret extends K8sObject {
  kind: "Secret";
  type?: string;
  /** Values stored base64-encoded, like the real API. */
  data?: Record<string, string>;
}

export type AccessMode = "ReadWriteOnce" | "ReadOnlyMany" | "ReadWriteMany" | "ReadWriteOncePod";

export interface K8sPersistentVolume extends K8sObject {
  kind: "PersistentVolume";
  spec: {
    capacity: { storage: string };
    accessModes: AccessMode[];
    storageClassName?: string;
    persistentVolumeReclaimPolicy?: "Retain" | "Delete" | "Recycle";
    hostPath?: { path: string };
    nfs?: { server: string; path: string };
  };
  status: { phase: "Available" | "Bound" | "Released" | "Failed"; claimRef?: string };
}

export interface K8sPersistentVolumeClaim extends K8sObject {
  kind: "PersistentVolumeClaim";
  spec: {
    accessModes: AccessMode[];
    resources: { requests: { storage: string } };
    storageClassName?: string;
    volumeName?: string;
  };
  status: { phase: "Pending" | "Bound" | "Lost"; capacity?: { storage: string } };
}

export interface K8sStorageClass extends K8sObject {
  kind: "StorageClass";
  provisioner: string;
  reclaimPolicy?: "Retain" | "Delete";
  volumeBindingMode?: "Immediate" | "WaitForFirstConsumer";
  allowVolumeExpansion?: boolean;
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export interface PolicyRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
  resourceNames?: string[];
}

export interface K8sRole extends K8sObject {
  kind: "Role";
  rules: PolicyRule[];
}

export interface K8sClusterRole extends K8sObject {
  kind: "ClusterRole";
  rules: PolicyRule[];
}

export interface RoleRef {
  apiGroup: string;
  kind: "Role" | "ClusterRole";
  name: string;
}

export interface RbacSubject {
  kind: "User" | "Group" | "ServiceAccount";
  name: string;
  namespace?: string;
}

export interface K8sRoleBinding extends K8sObject {
  kind: "RoleBinding";
  roleRef: RoleRef;
  subjects: RbacSubject[];
}

export interface K8sClusterRoleBinding extends K8sObject {
  kind: "ClusterRoleBinding";
  roleRef: RoleRef;
  subjects: RbacSubject[];
}

export interface K8sServiceAccount extends K8sObject {
  kind: "ServiceAccount";
}

// ---------------------------------------------------------------------------
// Namespaces & events
// ---------------------------------------------------------------------------

export interface K8sNamespace extends K8sObject {
  kind: "Namespace";
  status: { phase: "Active" | "Terminating" };
}

export interface K8sEvent {
  type: "Normal" | "Warning";
  reason: string;
  message: string;
  /** e.g. "Pod/web-5d78f9c6b-x2v4q" */
  involvedObject: string;
  namespace: string;
  /** e.g. "2m", "45s" — display-only age. */
  age: string;
  source?: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Cluster state root
// ---------------------------------------------------------------------------

export interface KubeContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
}

export interface ClusterState {
  nodes: K8sNode[];
  namespaces: K8sNamespace[];
  pods: K8sPod[];
  deployments: K8sDeployment[];
  replicasets: K8sReplicaSet[];
  services: K8sService[];
  configmaps: K8sConfigMap[];
  secrets: K8sSecret[];
  persistentvolumes: K8sPersistentVolume[];
  persistentvolumeclaims: K8sPersistentVolumeClaim[];
  storageclasses: K8sStorageClass[];
  networkpolicies: K8sNetworkPolicy[];
  roles: K8sRole[];
  rolebindings: K8sRoleBinding[];
  clusterroles: K8sClusterRole[];
  clusterrolebindings: K8sClusterRoleBinding[];
  serviceaccounts: K8sServiceAccount[];
  events: K8sEvent[];
  contexts: KubeContext[];
  currentContext: string;
  /**
   * Simulator-only bookkeeping for mocked etcdctl commands, so checkers can
   * grade etcd exercises without modeling etcd internals.
   */
  etcd: {
    /** Paths passed to `etcdctl snapshot save`. */
    snapshotsSaved: string[];
    /** Last `--data-dir` used with `etcdctl snapshot restore`, if any. */
    restoredFrom?: { snapshotPath: string; dataDir: string };
  };
}

/** Namespaces every fixture gets unless it overrides them. */
export const DEFAULT_NAMESPACES = ["default", "kube-system", "kube-public", "kube-node-lease"];

export function makeNamespace(name: string): K8sNamespace {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name, creationTimestamp: "2026-07-01T09:00:00Z" },
    status: { phase: "Active" },
  };
}

/** Empty-but-valid state; fixtures spread over this so new fields never break old fixtures. */
export function emptyClusterState(): ClusterState {
  return {
    nodes: [],
    namespaces: DEFAULT_NAMESPACES.map(makeNamespace),
    pods: [],
    deployments: [],
    replicasets: [],
    services: [],
    configmaps: [],
    secrets: [],
    persistentvolumes: [],
    persistentvolumeclaims: [],
    storageclasses: [],
    networkpolicies: [],
    roles: [],
    rolebindings: [],
    clusterroles: [],
    clusterrolebindings: [],
    serviceaccounts: [],
    events: [],
    contexts: [
      { name: "kubernetes-admin@kubernetes", cluster: "kubernetes", user: "kubernetes-admin" },
    ],
    currentContext: "kubernetes-admin@kubernetes",
    etcd: { snapshotsSaved: [] },
  };
}

/** Standard two-node lab cluster used as the base for most fixtures. */
export function makeNode(
  name: string,
  opts: {
    controlPlane?: boolean;
    ready?: boolean;
    unschedulable?: boolean;
    taints?: Taint[];
    kubeletVersion?: string;
  } = {},
): K8sNode {
  const {
    controlPlane = false,
    ready = true,
    unschedulable,
    taints,
    kubeletVersion = "v1.35.1",
  } = opts;
  return {
    apiVersion: "v1",
    kind: "Node",
    metadata: {
      name,
      labels: {
        "kubernetes.io/hostname": name,
        ...(controlPlane ? { "node-role.kubernetes.io/control-plane": "" } : {}),
      },
      creationTimestamp: "2026-06-01T08:00:00Z",
    },
    spec: {
      ...(unschedulable ? { unschedulable } : {}),
      taints:
        taints ??
        (controlPlane
          ? [{ key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule" }]
          : undefined),
    },
    status: {
      conditions: [
        ready
          ? { type: "Ready", status: "True", reason: "KubeletReady" }
          : {
              type: "Ready",
              status: "False",
              reason: "KubeletNotReady",
              message: "container runtime network not ready",
            },
      ],
      nodeInfo: {
        kubeletVersion,
        containerRuntimeVersion: "containerd://1.7.27",
        osImage: "Ubuntu 24.04.2 LTS",
      },
      capacity: { cpu: "4", memory: "8Gi", pods: "110" },
      addresses: [{ type: "Hostname", address: name }],
    },
    roles: controlPlane ? ["control-plane"] : [],
  };
}
