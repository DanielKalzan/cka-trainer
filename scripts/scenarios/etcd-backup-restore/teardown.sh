#!/usr/bin/env bash
# Remove the exercise's artifacts from the control-plane node. The copied
# etcdctl/etcdutl binaries stay — harmless, and the next session skips the copy.
set -euo pipefail

NODE="cka-trainer-control-plane"

docker exec "$NODE" bash -c '
  rm -rf /opt/backup /var/lib/etcd-restored
'
