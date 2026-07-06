# How to Run & Use CKA Trainer

Practical guide: what it needs, how to start it, how to use it day-to-day, how to fix common problems.

## What it is

Self-paced study app for CKA exam. Lessons + quizzes + real hands-on terminal exercises graded against an actual local Kubernetes cluster (`kind`), not a simulation.

## Resource requirements

Runs 5 Docker containers total: 3 kind nodes (1 control-plane + 2 workers) plus the `app` container (Next.js + terminal bridge) plus the one-shot `cluster-init` container.

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB free | 8 GB+ free |
| Disk | 5 GB free | 10 GB+ free (node images + pulled exercise images) |
| Docker | required, running | — |

Notes:
- Each kind node is a full Docker container running a kubelet + control plane bits — three of them is heavier than a single-node cluster but needed for drain/taint/scheduling exercises.
- Exercise images (`nginx`, `redis`, `postgres`, `busybox` — see `scripts/cluster/exercise-images.txt`) get pulled lazily into the cluster on first use; budget extra disk/bandwidth on first run through exercises.
- Nothing GPU-related. CPU/RAM above is the real constraint, not disk (unless very tight).

## Prerequisites

- Docker installed and running
- Docker Compose v2 (`docker compose`, not the old `docker-compose`)
- Nothing else — no local Node.js, no `kubectl`, no `kind` install. All of it runs inside the containers.

## First-time setup

```bash
docker compose up --build
```

That's the whole setup. First run builds two images and creates the kind cluster (~1-2 min); subsequent runs reuse both.

## Access

| Thing | URL / address |
|---|---|
| Web app | http://localhost:3000 |
| Terminal bridge (WebSocket, used internally by the browser terminal) | ws://127.0.0.1:3001/term |

Bridge binds `0.0.0.0` — reachable from your PC's LAN IP as well as `localhost` (gated by request Origin, not by bind address). It gives real shell access to your machine, so only run this on a trusted network, not shared/public wifi.

## Day-to-day use

1. `docker compose up` (no `--build` needed unless `package.json` or a Dockerfile changed; `Ctrl+C` stops it)
2. Open http://localhost:3000
3. Pick a domain (Troubleshooting, Cluster Architecture, Services & Networking, Workloads & Scheduling, Storage) — weighted per the real CKA exam curriculum
4. Work through lessons → quiz → terminal exercises per domain
5. Terminal exercises spin up a real namespace (`ex-<exerciseId>-<timestamp>`) on the cluster, you solve it with real `kubectl`, an async checker queries the live cluster to grade you
6. Progress/XP/streaks are saved in the browser (localStorage) — cluster state is disposable, your progress isn't
7. Mock exam mode runs multiple live exercises under time pressure

Terminal exercises are the core feature and require the live cluster — there's no lighter "frontend only" mode.

## What's running under the hood

`docker-compose.yml` defines 3 services:

| Service | Role |
|---|---|
| `cluster-init` | One-shot. Builds a tiny `kind`+`kubectl` image, creates the `cka-trainer` kind cluster (1 control-plane + 2 workers) via the host Docker socket, writes `.kubeconfig`, best-effort preloads exercise images, exits 0. |
| `app` | Builds the Node 24 + kubectl + vim + docker-CLI image, runs `npm run dev` (Next.js frontend + terminal bridge). Starts only after `cluster-init` exits successfully. |
| `cluster-down` | Teardown-only, doesn't run on a normal `up` (`profiles: ["teardown"]`). |

Both `cluster-init` and `app` use `network_mode: host`, so they bind straight to the host's ports (`3000`/`3001`, the latter on `0.0.0.0` so your PC's LAN IP reaches it too) — no port mapping needed.

## Cluster lifecycle commands

| Command | Effect |
|---|---|
| `docker compose up` | Start everything; reuses the cluster and images if they already exist. |
| `docker compose up --build` | Rebuild images first (needed after `package.json` or Dockerfile changes). |
| `docker compose down` | Stop and remove the `app`/`cluster-init` containers. **Leaves the kind cluster running** (it's a separate set of containers, created via the host Docker socket, not managed by compose's own lifecycle). |
| `docker compose down -v` | Same, plus wipes the `node_modules`/`next_cache` named volumes — use for a truly clean rebuild. |
| `docker compose --profile teardown run --rm cluster-down` | Actually deletes the kind cluster. |
| `./bin/kind delete cluster --name cka-trainer` (if you ever ran the cluster natively before switching to compose) | Removes a stray non-compose cluster so `cluster-init` doesn't collide with it. |

An exercise's own "Reset" button just deletes+reapplies its namespace — much cheaper than a full cluster teardown.

## Troubleshooting

**`app` container exits with `EMFILE: too many open files, watch '/app/server/index.ts'`**
The `tsx watch` file watcher ran out of inotify instances. Host's `fs.inotify.max_user_instances` is a low default (128) — Next.js's own watcher can eat most of it before the bridge's watcher even starts. Fix on the host (needs sudo, can't be done from inside the container — it's a system-wide kernel limit):
```bash
sudo sysctl -w fs.inotify.max_user_instances=8192
```
Persist across reboots by adding `fs.inotify.max_user_instances=8192` to `/etc/sysctl.conf`. Then `docker compose up app` again (no rebuild needed).

**`cluster-init` fails: `failed to get cluster internal kubeconfig ... container ... is not running`**
Stale kind cluster — its control-plane container exists but stopped (e.g. after a Docker/host restart), and `cluster-init` tried to refresh a kubeconfig against a dead container. Nuke and let compose recreate it:
```bash
docker compose down
docker exec -it $(docker ps -aq -f name=cka-trainer) true 2>/dev/null  # (no-op, just illustrating containers may be gone)
./bin/kind delete cluster --name cka-trainer 2>/dev/null || true
rm -f .kubeconfig
docker compose up --build
```

**`EACCES: permission denied` on `.kubeconfig`, or a host `node_modules`/`.next` left owned by `root`**
Usually residue from running things natively with `sudo`, or from `.kubeconfig` being written by `cluster-init` running as root inside its container while bind-mounted to the host path. Safe to remove and let compose regenerate:
```bash
docker compose down -v
rm -f .kubeconfig
docker compose up --build
```

**Port 3000/3001 already in use**
Something else is bound to those ports — check for a leftover native `next dev`/`tsx` process (`pgrep -fa "next dev|tsx watch"`) or a second compose stack, and stop it. Compose won't start `app` cleanly while they're held.

**Exercise stuck "pulling image"**
First-time pull of that exercise's image on the kind nodes; slow but one-time. Check `scripts/cluster/exercise-images.txt` — new exercises must add their image there so the preloader picks it up.

## Reference docs

- `README.md` — quickstart, security note
- `CLAUDE.md` — architecture/conventions, exam domain weights
- `MIGRATION_PROMPT.md` — history of the move from simulated to real cluster
