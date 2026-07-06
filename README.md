# CKA Trainer

A gamified, self-paced study app for the CKA (Certified Kubernetes Administrator) exam. Lessons, quizzes, and — the core of it — hands-on terminal exercises graded automatically against a **real local Kubernetes cluster**.

> ⚠️ This is **not** a static web app. The terminal exercises run real `kubectl` against a local [kind](https://kind.sigs.k8s.io/) (Kubernetes-in-Docker) cluster, streamed to the browser through a small local backend. Docker must be running.

## Prerequisites

- **Docker** — installed and running (the cluster nodes are Docker containers)
- **kubectl** — on your PATH ([install](https://kubernetes.io/docs/tasks/tools/))
- **Node.js** 20+
- `kind` is **not** required up front — if it's missing, `npm run cluster:up` downloads a pinned release into `./bin/` (no sudo, gitignored)

## Quickstart

```bash
npm install
npm run cluster:up   # create the local kind cluster (~1-2 min first run)
npm run dev          # frontend + terminal bridge
```

Open http://localhost:3000.

## Alternative: run everything with Docker Compose

No local Node/kubectl needed — only Docker:

```bash
docker compose up --build
```

That starts a one-shot `cluster-init` service (creates or reuses the kind cluster through the host Docker socket, writes `./.kubeconfig`) and the `app` service (frontend + bridge, with kubectl/vim baked in). Both use host networking (Linux), so the URLs are the same: http://localhost:3000.

- `docker compose down` stops the app but **leaves the cluster running**
- `docker compose --profile teardown run --rm cluster-down` deletes the cluster
- after changing `package.json`: `docker compose build app && docker compose run --rm app npm ci` (node_modules lives in a named volume)

Don't run `npm run dev` and the compose stack at the same time — they share ports 3000/3001 (the bridge will tell you exactly that if it happens).

## Cluster management

| Command | What it does |
|---|---|
| `npm run cluster:up` | Create the `cka-trainer` kind cluster (1 control-plane + 2 workers, k8s pinned to the CKA exam version). Idempotent — reuses an existing cluster. Also pre-loads the exercise images onto the nodes (best-effort) so exercises never stall on a first pull. |
| `npm run cluster:down` | Delete the cluster and its kubeconfig. |
| `npm run cluster:reset` | Full delete + recreate. Per-exercise reset is namespace-scoped and doesn't need this — this is the nuke option. |

The cluster's kubeconfig is written to `./.kubeconfig` (gitignored). Everything in this app — terminal sessions, exercise checkers, scripts — uses that file exclusively; **your `~/.kube/config` and its contexts are never touched.**

## Security note

The terminal bridge binds to `127.0.0.1` only and gives the browser terminal a real shell on your machine (that's the point — real `kubectl`, real vim, real cluster). Single-user, local-only by design. Don't expose the bridge port to a network.

## Scripts

- `npm run dev` — dev server (Next.js frontend + terminal bridge)
- `npm run build` — production build
- `npm run lint` — eslint
- `npm run test` — vitest

## Docs

- `CLAUDE.md` — living architecture/conventions reference
- `MIGRATION_PROMPT.md` — why and how the terminal moved from an in-memory simulation to a real kind cluster
