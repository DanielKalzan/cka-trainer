import * as path from "path";
import * as k8s from "@kubernetes/client-node";

/**
 * Server-side only — used by the bridge to grade exercises against the real
 * cluster. Never import from client components.
 */

const KUBECONFIG_PATH = path.resolve(__dirname, "../../.kubeconfig");

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
