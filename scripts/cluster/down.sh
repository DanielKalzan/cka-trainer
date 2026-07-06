#!/usr/bin/env bash
# Delete the local kind training cluster and its kubeconfig.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/preflight.sh"

if "$KIND_BIN" get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  "$KIND_BIN" delete cluster --name "$CLUSTER_NAME" --kubeconfig "$KUBECONFIG_PATH"
else
  echo "Cluster '$CLUSTER_NAME' does not exist — nothing to delete."
fi
rm -f "$KUBECONFIG_PATH"
