# Migration: Replace Simulated kubectl Terminal with a Real kind Cluster

## Context

This app is already built and I'm testing it. Everything works **except** the simulated `kubectl` terminal — it's an in-memory JS fixture pretending to be a cluster, and the illusion breaks constantly (e.g. `--dry-run=client` doesn't work, editing a Pod's YAML doesn't trigger any reconciliation). This isn't a couple of bugs to patch — a hand-rolled simulation can never fully match real Kubernetes behavior (admission control, immutability rules, reconciliation loops, etc).

**This is a scoped migration, not a rebuild.** Keep everything as-is except the terminal engine and exercise-runtime layer: gamification (XP/streak/levels), content model (lessons, quiz), dashboard, routing, and design system should not change.

## Goal

Replace the in-memory simulated cluster with a **real local Kubernetes cluster** (via `kind` — Kubernetes-in-Docker), so `kubectl` commands hit a genuine API server. The user-facing experience should stay the same: pick an exercise → get a scenario → type real commands in a terminal UI → get graded. Only the internals change from "fake state" to "real cluster."

## New architecture

- **Local cluster**: a `kind` cluster, defined by a committed `kind-config.yaml`, created/destroyed via npm scripts (`npm run cluster:up`, `npm run cluster:down`, `npm run cluster:reset`). Requires Docker running locally — this app is no longer a pure static/client-only deployable; it now requires a local backend process. Update the README with this prerequisite.
- **Terminal bridge (new small backend)**: a Node process that, per session, spawns a real PTY running `kubectl` (scoped to a specific context/namespace) and streams stdin/stdout over a WebSocket. Use `node-pty` (or equivalent) server-side and `xterm.js` client-side to replace whatever fake-terminal UI component currently renders output.
- **Exercise lifecycle**: each exercise now ships a real Kubernetes manifest (YAML) instead of a JS fixture. Starting an exercise = create a dedicated namespace (e.g. `ex-<exerciseId>-<timestamp>`) and `kubectl apply -f` the setup manifest into it. Resetting = delete the namespace and reapply. Clean up abandoned exercise namespaces on a timer or on app start (don't let them accumulate).
- **Checker**: replace the pure `checker(state) => boolean` function with an async version that queries the **real cluster** via `@kubernetes/client-node` (e.g. "does a Deployment named X exist in this namespace with 3 replicas and the correct image") instead of inspecting an in-memory object. Keep the same checker signature/return shape (`{ passed, feedback }`) so the grading UI and gamification hooks don't need to change.
- **Node-level troubleshooting scenarios** (e.g. a NotReady node, a broken kubelet, broken CoreDNS): since `kind` nodes are themselves containers, these need a setup script that reaches into the kind node container (e.g. `docker exec` to stop a service or corrupt a config) rather than a namespace-scoped manifest. Build a small `scripts/scenarios/` collection for these special cases, invoked by the exercise's own `setup()`/`teardown()` hooks rather than a generic YAML apply.
- **Safety/resource limits**: cap total exercise namespaces, add resource requests/limits to spawned workloads so a broken exercise can't exhaust the local Docker VM.

## What should NOT change

- Content schema for lessons/quiz (still static data, still no backend needed for those)
- Gamification store, XP/streak/badge logic
- Routing, dashboard, design system
- The exercise interface as seen by the rest of the app (`id`, `domainId`, `title`, `scenario`, `hints`, `points`, `difficulty`) — only `initialState` becomes `manifest` (or `setup()`/`teardown()` for node-level scenarios), and `checker` becomes async.

## Migration order

1. **Inspect first.** Read the current terminal-engine code, exercise data files, and checker implementations before changing anything. Confirm your understanding of what exists today matches this doc — flag any mismatch before proceeding.
2. `kind` cluster scaffolding + npm scripts (`cluster:up/down/reset`). Verify manually that `kubectl get nodes` against it works from a plain terminal.
3. PTY + WebSocket bridge, wired to a **plain terminal with no grading** — verify real `kubectl` commands (including `--dry-run=client -o yaml` and editing objects) behave correctly in the browser before touching exercise/grading logic.
4. Convert **one domain's** exercises (pick whichever domain has the fewest exercises) from JS fixture + sync checker → real manifest + async client-node checker. Get this fully working end-to-end, including reset, before converting the rest.
5. Convert remaining domains' exercises the same way.
6. Build the node-level scenario scripts for the troubleshooting exercises that need them.
7. Remove the old in-memory simulation code once parity is confirmed across all domains.

Pause after step 3 and after step 4 for me to manually verify before continuing — these are the two riskiest steps.

## Instructions for you (Claude Code)

- Use Plan Mode. Show me the plan for steps 1–3 before writing code.
- Don't touch gamification, content schemas, or routing unless a change is strictly required by this migration — if you think one is required, flag it and explain why before changing it.
- `CLAUDE.md` has been updated to reflect the target architecture — treat it as authoritative alongside this doc.
