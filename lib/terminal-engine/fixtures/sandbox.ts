import {
  emptyClusterState,
  makeNode,
  type ClusterState,
  type K8sDeployment,
} from "../cluster-state";
import { syncDeployment } from "../commands/helpers";

/**
 * Default cluster for the free-form sandbox: two workers + control plane,
 * a couple of workloads, storage objects and a broken pod to poke at.
 */
export function sandboxState(): ClusterState {
  const state = emptyClusterState();
  state.nodes = [
    makeNode("controlplane", { controlPlane: true }),
    makeNode("node01"),
    makeNode("node02"),
  ];

  const web: K8sDeployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "web",
      namespace: "default",
      labels: { app: "web" },
      creationTimestamp: "2026-07-03T09:00:00Z",
    },
    spec: {
      replicas: 3,
      selector: { matchLabels: { app: "web" } },
      template: {
        metadata: { labels: { app: "web" } },
        spec: {
          containers: [{ name: "web", image: "nginx:1.27", ports: [{ containerPort: 80 }] }],
        },
      },
    },
    status: {},
    rolloutHistory: [{ revision: 1, image: "nginx:1.27" }],
  };
  const api: K8sDeployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "api",
      namespace: "default",
      labels: { app: "api" },
      creationTimestamp: "2026-07-04T14:30:00Z",
    },
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: "api" } },
      template: {
        metadata: { labels: { app: "api" } },
        spec: {
          containers: [{ name: "api", image: "httpd:2.4", ports: [{ containerPort: 8080 }] }],
        },
      },
    },
    status: {},
    rolloutHistory: [{ revision: 1, image: "httpd:2.4" }],
  };
  state.deployments.push(web, api);
  syncDeployment(state, web);
  syncDeployment(state, api);

  // One broken pod to practice reading errors
  state.pods.push({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: "debugger",
      namespace: "default",
      labels: { run: "debugger" },
      creationTimestamp: "2026-07-05T11:40:00Z",
    },
    spec: {
      containers: [{ name: "debugger", image: "busybox:1.99-doesnotexist" }],
      nodeName: "node01",
    },
    status: {
      phase: "Pending",
      containerStatuses: [
        {
          name: "debugger",
          ready: false,
          restartCount: 0,
          state: "ImagePullBackOff",
          stateMessage: 'Back-off pulling image "busybox:1.99-doesnotexist"',
        },
      ],
    },
    mockLogs: { "": "" },
  });
  state.events.push({
    type: "Warning",
    reason: "Failed",
    message: 'Failed to pull image "busybox:1.99-doesnotexist": not found',
    involvedObject: "Pod/debugger",
    namespace: "default",
    age: "20m",
    count: 8,
  });

  state.services.push({
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "web",
      namespace: "default",
      labels: { app: "web" },
      creationTimestamp: "2026-07-03T09:05:00Z",
    },
    spec: {
      type: "ClusterIP",
      selector: { app: "web" },
      clusterIP: "10.96.114.23",
      ports: [{ port: 80, targetPort: 80, protocol: "TCP" }],
    },
  });

  state.configmaps.push({
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name: "app-config", namespace: "default", creationTimestamp: "2026-07-03T09:00:00Z" },
    data: { LOG_LEVEL: "info", FEATURE_FLAGS: "beta-search=true" },
  });

  state.storageclasses.push({
    apiVersion: "storage.k8s.io/v1",
    kind: "StorageClass",
    metadata: { name: "local-path", creationTimestamp: "2026-06-01T08:00:00Z" },
    provisioner: "rancher.io/local-path",
    reclaimPolicy: "Delete",
    volumeBindingMode: "WaitForFirstConsumer",
  });
  state.persistentvolumes.push({
    apiVersion: "v1",
    kind: "PersistentVolume",
    metadata: { name: "pv-logs", creationTimestamp: "2026-06-20T10:00:00Z" },
    spec: {
      capacity: { storage: "5Gi" },
      accessModes: ["ReadWriteOnce"],
      storageClassName: "manual",
      persistentVolumeReclaimPolicy: "Retain",
      hostPath: { path: "/mnt/data/logs" },
    },
    status: { phase: "Available" },
  });

  state.serviceaccounts.push({
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: { name: "default", namespace: "default", creationTimestamp: "2026-06-01T08:00:00Z" },
  });

  return state;
}
