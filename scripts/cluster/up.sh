#!/usr/bin/env bash
# Create (or reuse) the local kind training cluster and write ./.kubeconfig.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/preflight.sh"

if "$KIND_BIN" get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "Cluster '$CLUSTER_NAME' already exists — refreshing kubeconfig."
  "$KIND_BIN" export kubeconfig --name "$CLUSTER_NAME" --kubeconfig "$KUBECONFIG_PATH"
else
  "$KIND_BIN" create cluster \
    --config "$REPO_ROOT/kind-config.yaml" \
    --kubeconfig "$KUBECONFIG_PATH" \
    --wait 120s
fi

echo
echo "Smoke test (kubectl get nodes):"
kubectl --kubeconfig "$KUBECONFIG_PATH" get nodes

bash "$(dirname "${BASH_SOURCE[0]}")/warm-images.sh" "$KIND_BIN" "$CLUSTER_NAME"

echo
echo "Cluster ready. All app components use $KUBECONFIG_PATH — your ~/.kube/config is untouched."
