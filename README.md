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

## Cluster management

| Command | What it does |
|---|---|
| `npm run cluster:up` | Create the `cka-trainer` kind cluster (1 control-plane + 2 workers, k8s pinned to the CKA exam version). Idempotent — reuses an existing cluster. |
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
