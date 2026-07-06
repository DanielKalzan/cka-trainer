#!/usr/bin/env bash
# Full cluster rebuild — the nuke option. Per-exercise reset is namespace-scoped
# and does not need this.
set -euo pipefail
dir="$(dirname "${BASH_SOURCE[0]}")"
bash "$dir/down.sh"
bash "$dir/up.sh"
