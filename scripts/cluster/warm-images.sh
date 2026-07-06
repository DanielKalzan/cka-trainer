#!/usr/bin/env bash
# Pre-load exercise images onto every kind node so sessions never stall on a
# first pull (this machine's registry access is slow — a cold redis pull takes
# ~2 min, which reads as a broken exercise). Best-effort: a failed preload only
# means that image pulls lazily later.
#
# Usage: warm-images.sh <kind-binary> <cluster-name>
set -uo pipefail

KIND_BIN="${1:?kind binary}"
CLUSTER_NAME="${2:?cluster name}"
IMAGES_FILE="$(dirname "${BASH_SOURCE[0]}")/exercise-images.txt"

echo "Preloading exercise images onto the '$CLUSTER_NAME' nodes (best-effort)…"
while read -r img; do
  [ -z "$img" ] && continue
  if docker pull -q "$img" >/dev/null 2>&1 \
    && "$KIND_BIN" load docker-image "$img" --name "$CLUSTER_NAME" >/dev/null 2>&1; then
    echo "  ✓ $img"
  else
    echo "  ⚠ $img (will pull lazily during exercises)"
  fi
done < "$IMAGES_FILE"
