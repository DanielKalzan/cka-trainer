# CKA Trainer — Project Memory

## What this is
A gamified, self-paced study web app for the CKA (Certified Kubernetes Administrator) exam, built for a single user. Core differentiator: a simulated `kubectl` terminal (no real cluster) used for hands-on grading, not just multiple-choice quizzes. See `BUILD_PROMPT.md` for the full spec — this file is the living reference for conventions once the build is underway.

## Stack
- Next.js 14 (App Router), TypeScript (strict)
- Tailwind CSS
- State: Zustand with `persist` middleware → localStorage. Client-only app, no backend/DB, no auth.
- Charts: Recharts (radar chart for domain readiness)
- Icons: lucide-react
- Animation: framer-motion — used sparingly, only for gamification feedback (XP gain, level up, streak)

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build (must pass with zero TS errors before a phase is considered done)
- `npm run lint` — eslint
- `npm run test` — vitest (terminal-engine unit + end-to-end exercise tests)

## Architecture
- `/content/<domain-slug>/lessons/*.ts` — lesson content, one file per lesson
- `/content/<domain-slug>/quiz.ts` — conceptual quiz questions for that domain
- `/content/<domain-slug>/exercises.ts` — terminal-based exercises for that domain
- `/lib/terminal-engine/` — the kubectl simulator: `parser.ts`, `cluster-state.ts`, `commands/*.ts` (one file per verb), `checker.ts`
- `/lib/gamification/` — XP/level math, streak logic, badge rules, readiness score calculation (pure functions)
- `/lib/constants/domains.ts` — the single source of truth for exam domain weights
- `/store/` — Zustand stores (`useProgressStore`, `useTerminalStore`)
- `/app/` — routes per Next.js App Router conventions, see site map in `BUILD_PROMPT.md` §7

## Exam domain weights (do not change without checking the current CNCF CKA curriculum)
Troubleshooting 30% · Cluster Architecture 25% · Services & Networking 20% · Workloads & Scheduling 15% · Storage 10%
Passing threshold: 66%.

## Conventions
- All content (lessons, quiz questions, exercises) is data, not hardcoded JSX. Adding new content should never require touching component code.
- Every terminal exercise has a `checker(state) => { passed, feedback }` function that inspects the resulting cluster state — never grade by string-matching the commands typed, since troubleshooting tasks have multiple valid solution paths.
- Lesson tips are typed `'exam-tip' | 'deep-dive'`. `deep-dive` content renders collapsed/optional in the UI — it's context, not required memorization.
- No backend, no sign-in, no database, no API keys. If a feature seems to need one, stop and flag it instead of adding it.
- Keep components small and colocated with their route where possible.
- `kubectl` output formatting should closely resemble real output (column alignment for `get`, full text for `describe`) — this realism is the point of the feature.

## Build order (see BUILD_PROMPT.md §9 for full detail — do not skip ahead)
1. Scaffold + design system + nav shell
2. Data schemas + ONE domain's worth of real content (Cluster Architecture)
3. Terminal engine, wired to phase-2 content end-to-end — **pause for manual review here**
4. Gamification layer (XP, streak, dashboard, radar chart)
5. Remaining 4 domains of content, same schema as phase 2
6. Mock exam mode + readiness score
7. Polish pass

## Verification
After each phase: `npm run build` must succeed, and the phase's feature must be manually clickable/testable in the browser before moving on. Commit to git at the end of each clean phase.
