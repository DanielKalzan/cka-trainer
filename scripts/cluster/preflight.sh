#!/usr/bin/env bash
# Shared preflight for the cluster scripts. Source this, don't run it.
# Exports: REPO_ROOT, CLUSTER_NAME, KUBECONFIG_PATH, KIND_BIN
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER_NAME="cka-trainer"
KUBECONFIG_PATH="$REPO_ROOT/.kubeconfig"
KIND_VERSION="v0.32.0"

die() {
  echo "error: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker: https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || die "Docker daemon not reachable. Start Docker and retry."

command -v kubectl >/dev/null 2>&1 || die "kubectl not found. Install: https://kubernetes.io/docs/tasks/tools/"

# Prefer a repo-local kind binary, then PATH; otherwise download the pinned
# release into ./bin (gitignored) so no sudo or global install is needed.
KIND_BIN="$REPO_ROOT/bin/kind"
if [[ ! -x "$KIND_BIN" ]]; then
  if command -v kind >/dev/null 2>&1; then
    KIND_BIN="$(command -v kind)"
  else
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    case "$(uname -m)" in
      x86_64) arch="amd64" ;;
      aarch64 | arm64) arch="arm64" ;;
      *) die "unsupported architecture: $(uname -m). Install kind manually: https://kind.sigs.k8s.io/docs/user/quick-start/#installation" ;;
    esac
    echo "kind not found — downloading kind $KIND_VERSION to ./bin/kind"
    mkdir -p "$REPO_ROOT/bin"
    curl -fsSLo "$KIND_BIN" \
      "https://github.com/kubernetes-sigs/kind/releases/download/$KIND_VERSION/kind-$os-$arch" ||
      die "kind download failed. Install manually: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
    chmod +x "$KIND_BIN"
  fi
fi

export REPO_ROOT CLUSTER_NAME KUBECONFIG_PATH KIND_BIN
