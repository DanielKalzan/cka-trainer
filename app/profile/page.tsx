"use client";

import { Award, Flame, RotateCcw, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getDomain } from "@/lib/constants/domains";
import { BADGES } from "@/lib/gamification/badges";
import { currentStreak } from "@/lib/gamification/streak";
import { levelProgress } from "@/lib/gamification/xp";
import { getAllExercises } from "@/lib/content/registry";
import { useProgressStore } from "@/store/useProgressStore";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const progress = useProgressStore();
  const { level, intoLevel, levelSpan, ratio } = levelProgress(progress.xp);
  const streak = currentStreak(progress.activityDates);
  const exerciseTitles = new Map(getAllExercises().map((e) => [e.id, e.title]));

  const stats = [
    { label: "Level", value: String(level), icon: Zap },
    { label: "Total XP", value: String(progress.xp), icon: Zap },
    { label: "Streak", value: `${streak}d`, icon: Flame },
    { label: "Lessons", value: String(Object.keys(progress.lessonsCompleted).length) },
    { label: "Exercises", value: String(Object.keys(progress.exercisesPassed).length) },
    { label: "Active days", value: String(progress.activityDates.length) },
  ];

  const passedExercises = Object.entries(progress.exercisesPassed).sort((a, b) =>
    a[1].at < b[1].at ? 1 : -1,
  );
  const quizEntries = Object.entries(progress.quizBest).filter(([, q]) => q);

  return (
    <>
      <PageHeader title="Profile" subtitle="Stats, badges and training history." />

      <div className="space-y-6">
        {/* Stats + level bar */}
        <section className="rounded-xl border border-edge bg-surface p-6">
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-bold">{s.value}</div>
                <div className="mt-0.5 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="flex justify-between font-mono text-xs text-muted">
              <span>level {level}</span>
              <span>
                {intoLevel} / {levelSpan} XP to level {level + 1}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-raised">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="rounded-xl border border-edge bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Award className="h-4 w-4" />
            Badges · {Object.keys(progress.badges).length}/{BADGES.length}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BADGES.map((b) => {
              const earnedAt = progress.badges[b.id];
              const Icon = b.icon;
              return (
                <div
                  key={b.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    earnedAt
                      ? "border-warning/40 bg-warning/5"
                      : "border-edge bg-raised/30 opacity-60"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      earnedAt ? "bg-warning/15 text-warning" : "bg-raised text-faint"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{b.name}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {b.description}
                    </p>
                    {earnedAt ? (
                      <p className="mt-1 font-mono text-[11px] text-warning">
                        earned {formatDate(earnedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* History */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-edge bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Exercises passed
            </h2>
            {passedExercises.length === 0 ? (
              <p className="text-sm text-faint">None yet — head to Practice.</p>
            ) : (
              <ul className="space-y-3">
                {passedExercises.map(([id, r]) => (
                  <li key={id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{exerciseTitles.get(id) ?? id}</span>
                      <span className="shrink-0 font-mono text-xs text-success">
                        +{r.xpAwarded} XP
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted">
                      {formatClock(r.timeSeconds)} / {formatClock(r.timeBudgetSeconds)} ·{" "}
                      {r.hintsUsed} hints · {formatDate(r.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-edge bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Quiz best scores
            </h2>
            {quizEntries.length === 0 ? (
              <p className="text-sm text-faint">No quiz runs yet.</p>
            ) : (
              <ul className="space-y-3">
                {quizEntries.map(([domainId, q]) => {
                  const domain = getDomain(domainId);
                  return (
                    <li key={domainId} className="text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{domain?.shortName ?? domainId}</span>
                        <span
                          className={`shrink-0 font-mono text-xs ${
                            q!.pct === 100 ? "text-success" : "text-muted"
                          }`}
                        >
                          {q!.pct}% ({q!.correct}/{q!.total})
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-muted">
                        {formatDate(q!.at)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Danger zone */}
        <section className="rounded-xl border border-danger/30 bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-danger">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-muted">
            Wipes XP, badges, streak and all completion history. No undo.
          </p>
          <button
            onClick={() => {
              if (window.confirm("Reset ALL progress? This cannot be undone.")) {
                useProgressStore.getState().resetProgress();
              }
            }}
            className="mt-3 flex items-center gap-2 rounded-lg border border-danger/50 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <RotateCcw className="h-4 w-4" />
            Reset progress
          </button>
        </section>
      </div>
    </>
  );
}
