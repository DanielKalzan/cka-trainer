import * as path from "path";
import * as k8s from "@kubernetes/client-node";

/**
 * Server-side only — used by the bridge to grade exercises against the real
 * cluster. Never import from client components.
 */

const KUBECONFIG_PATH =
  process.env.KUBECONFIG ?? path.resolve(__dirname, "../../.kubeconfig");

let cached: k8s.KubeConfig | null = null;

export function kubeConfig(): k8s.KubeConfig {
  if (!cached) {
    cached = new k8s.KubeConfig();
    cached.loadFromFile(KUBECONFIG_PATH);
  }
  return cached;
}

export function coreApi(): k8s.CoreV1Api {
  return kubeConfig().makeApiClient(k8s.CoreV1Api);
}

export function storageApi(): k8s.StorageV1Api {
  return kubeConfig().makeApiClient(k8s.StorageV1Api);
}

export function appsApi(): k8s.AppsV1Api {
  return kubeConfig().makeApiClient(k8s.AppsV1Api);
}

export function rbacApi(): k8s.RbacAuthorizationV1Api {
  return kubeConfig().makeApiClient(k8s.RbacAuthorizationV1Api);
}

export function networkingApi(): k8s.NetworkingV1Api {
  return kubeConfig().makeApiClient(k8s.NetworkingV1Api);
}

export function autoscalingApi(): k8s.AutoscalingV2Api {
  return kubeConfig().makeApiClient(k8s.AutoscalingV2Api);
}

export function discoveryApi(): k8s.DiscoveryV1Api {
  return kubeConfig().makeApiClient(k8s.DiscoveryV1Api);
}

export function authorizationApi(): k8s.AuthorizationV1Api {
  return kubeConfig().makeApiClient(k8s.AuthorizationV1Api);
}

/** Parses a Kubernetes memory quantity ("256Mi", "1Gi", "128974848") to bytes. */
export function parseMemoryBytes(qty: string): number {
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  };
  const match = qty.match(/^(\d+(?:\.\d+)?)([A-Za-z]*)$/);
  if (!match) return NaN;
  const [, num, unit] = match;
  const multiplier = unit ? units[unit] ?? NaN : 1;
  return parseFloat(num) * multiplier;
}

/** Ready endpoint addresses behind a Service, via EndpointSlices. */
export async function readyEndpointCount(namespace: string, service: string): Promise<number> {
  const slices = await discoveryApi().listNamespacedEndpointSlice({
    namespace,
    labelSelector: `kubernetes.io/service-name=${service}`,
  });
  return slices.items
    .flatMap((s) => s.endpoints ?? [])
    .filter((e) => e.conditions?.ready !== false).length;
}

/** Resolve to null on 404 instead of throwing — "not created yet" is a normal
 *  grading outcome, not an error. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof k8s.ApiException && err.code === 404) return null;
    throw err;
  }
}
