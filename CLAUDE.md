# CKA Trainer — Project Memory

## What this is
A gamified, self-paced study web app for the CKA (Certified Kubernetes Administrator) exam, built for a single user. Core differentiator: hands-on terminal exercises graded automatically, not just multiple-choice quizzes. The terminal runs against a **real local Kubernetes cluster (`kind`)**, not an in-memory simulation — see `MIGRATION_PROMPT.md` for why and how this changed. See `BUILD_PROMPT.md` for the original full spec — this file is the living reference for current conventions.

## Stack
- Next.js 14 (App Router), TypeScript (strict)
- Tailwind CSS
- State: Zustand with `persist` middleware → localStorage, for progress/gamification only
- Charts: Recharts (radar chart for domain readiness)
- Icons: lucide-react
- Animation: framer-motion — used sparingly, only for gamification feedback (XP gain, level up, streak)
- **Local cluster**: `kind` (Kubernetes-in-Docker), config in `kind-config.yaml`. Requires Docker running locally.
- **Terminal bridge**: a small Node backend spawning a real PTY (`node-pty`) running `kubectl`, streamed over WebSocket to `xterm.js` in the browser
- **Cluster queries**: `@kubernetes/client-node` — used by exercise checkers to inspect real cluster state

⚠️ This app is **no longer a pure client-only/static deployable**. It requires Docker + a local backend process to run. Don't reintroduce "no backend" assumptions.

## Commands
- `npm run dev` — start dev server (frontend + terminal bridge)
- `npm run build` — production build (must pass with zero TS errors before a phase is considered done)
- `npm run lint` — eslint
- `npm run cluster:up` / `cluster:down` / `cluster:reset` — manage the local `kind` cluster

## Architecture
- `/content/<domain-slug>/lessons/*.ts` — lesson content, one file per lesson
- `/content/<domain-slug>/quiz.ts` — conceptual quiz questions for that domain
- `/content/<domain-slug>/exercises/*.ts` — exercise metadata (id, domainId, title, scenario, hints, points, difficulty) + a reference to its manifest/scenario script
- `/content/<domain-slug>/manifests/*.yaml` — real Kubernetes manifests used as exercise setup state
- `/scripts/scenarios/` — setup/teardown scripts for node-level troubleshooting exercises that need to reach into the `kind` node container directly (e.g. stopping kubelet, breaking CoreDNS) rather than a namespace-scoped manifest
- `/server/` — the terminal bridge: WebSocket server, PTY spawning, namespace lifecycle (create/reset/cleanup per exercise session)
- `/lib/checkers/` — async `checker(namespace) => Promise<{ passed, feedback }>` functions per exercise, querying the real cluster via `@kubernetes/client-node`
- `/lib/gamification/` — XP/level math, streak logic, badge rules, readiness score calculation (pure functions, unaffected by the cluster migration)
- `/lib/constants/domains.ts` — the single source of truth for exam domain weights
- `/store/` — Zustand stores (`useProgressStore` for gamification; terminal session state now lives server-side per WebSocket connection, not in a client store)
- `/app/` — routes per Next.js App Router conventions, see site map in `BUILD_PROMPT.md` §7

## Exam domain weights (do not change without checking the current CNCF CKA curriculum)
Troubleshooting 30% · Cluster Architecture 25% · Services & Networking 20% · Workloads & Scheduling 15% · Storage 10%
Passing threshold: 66%.

## Conventions
- All content (lessons, quiz questions, exercises) is data, not hardcoded JSX. Adding new content should never require touching component code.
- Every terminal exercise has an **async** `checker(namespace) => Promise<{ passed, feedback }>` function that queries the real cluster via `@kubernetes/client-node` — never grade by string-matching the commands typed, since troubleshooting tasks have multiple valid solution paths.
- Exercise setup is a real manifest applied to a dedicated namespace (`ex-<exerciseId>-<timestamp>`), except node-level troubleshooting scenarios, which use a `setup()`/`teardown()` script under `/scripts/scenarios/` instead.
- Reset = delete the exercise namespace and reapply/rerun setup. Clean up abandoned exercise namespaces periodically — don't let them accumulate on the local `kind` cluster.
- Lesson tips are typed `'exam-tip' | 'deep-dive'`. `deep-dive` content renders collapsed/optional in the UI — it's context, not required memorization.
- Gamification, content schemas (lessons/quiz), and routing are backend-free and should stay that way — only the terminal/exercise layer talks to the local cluster and backend.
- Keep components small and colocated with their route where possible.
- `kubectl` output is now real terminal output via PTY — no formatting logic needed for `get`/`describe`, that's the whole point.

## Migration status
The terminal engine was migrated from an in-memory simulation to a real `kind` cluster — see `MIGRATION_PROMPT.md` for the full plan and rationale (the simulation couldn't reliably reproduce `--dry-run=client`, reconciliation behavior, immutability rules, etc). Follow the migration order in that doc; don't re-introduce in-memory cluster state.

## Verification
After each migration step: manually verify the terminal behavior in the browser (not just `npm run build` passing) before moving to the next step — this migration is specifically about closing gaps between "looks right" and "behaves right." Commit to git at the end of each clean step.