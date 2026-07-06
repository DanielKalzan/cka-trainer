#!/usr/bin/env bash
# Prepare the control-plane node for the etcd backup/restore exercise:
#  - make etcdctl/etcdutl available on the node (copied out of the running
#    etcd container's rootfs — exact version match, no network)
#  - fresh /opt/backup, no leftover restore dir from a previous session
set -euo pipefail

NODE="cka-trainer-control-plane"

docker exec "$NODE" bash -c '
  set -euo pipefail
  if ! command -v etcdctl >/dev/null || ! command -v etcdutl >/dev/null; then
    for bin in etcdctl etcdutl; do
      src=$(find /run/containerd/io.containerd.runtime.v2.task/k8s.io \
        -maxdepth 6 -path "*/rootfs/usr/local/bin/$bin" 2>/dev/null | head -1)
      [ -n "$src" ] || { echo "error: $bin not found in any container rootfs" >&2; exit 1; }
      cp "$src" /usr/local/bin/"$bin"
    done
  fi
  mkdir -p /opt/backup
  rm -f /opt/backup/etcd-snapshot.db
  rm -rf /var/lib/etcd-restored
'
