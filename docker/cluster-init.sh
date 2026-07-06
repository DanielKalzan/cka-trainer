#!/usr/bin/env bash
# One-shot init: ensure the kind cluster exists and write ./.kubeconfig.
# Runs with the host Docker socket and host network namespace, so kind behaves
# exactly as it would from the host CLI (the kind nodes are sibling containers).
set -euo pipefail
cd /work

CLUSTER_NAME="cka-trainer"

docker info >/dev/null 2>&1 || {
  echo "error: host Docker socket not reachable — is /var/run/docker.sock mounted?" >&2
  exit 1
}

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "Cluster '$CLUSTER_NAME' already exists — refreshing kubeconfig."
else
  kind create cluster --config kind-config.yaml --wait 120s
fi

kind get kubeconfig --name "$CLUSTER_NAME" > .kubeconfig

echo
echo "Smoke test (kubectl get nodes):"
kubectl --kubeconfig .kubeconfig get nodes

bash scripts/cluster/warm-images.sh "$(command -v kind)" "$CLUSTER_NAME"
