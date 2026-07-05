"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { DOMAINS, PASS_THRESHOLD } from "@/lib/constants/domains";
import { useExamStore } from "@/store/useExamStore";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ExamResults({ attemptId }: { attemptId: string }) {
  const attempts = useExamStore((s) => s.attempts);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useExamStore.persist.hasHydrated()) setHydrated(true);
    return useExamStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  if (!hydrated) return null;

  const attempt = attempts[attemptId];
  if (!attempt) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center">
        <p className="text-muted">No attempt with this id on this device.</p>
        <Link href="/exam" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to Mock Exam
        </Link>
      </div>
    );
  }

  const byDomain = DOMAINS.map((domain) => {
    const results = attempt.results.filter((r) => r.domainId === domain.id);
    const total = results.reduce((sum, r) => sum + r.points, 0);
    const earned = results.filter((r) => r.passed).reduce((sum, r) => sum + r.points, 0);
    return { domain, total, earned, count: results.length };
  }).filter((d) => d.count > 0);

  return (
    <div className="space-y-6">
      {/* Score hero */}
      <section className="rounded-xl border border-edge bg-surface p-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`font-mono text-5xl font-bold ${
              attempt.passed ? "text-success" : "text-danger"
            }`}
          >
            {attempt.scorePct}%
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              attempt.passed ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            }`}
          >
            {attempt.passed ? "PASS" : "FAIL"} · bar at {PASS_THRESHOLD}%
          </span>
          <span className="flex items-center gap-1.5 font-mono text-sm text-muted">
            <Clock className="h-4 w-4" />
            {formatClock(attempt.timeUsedSeconds)} / {formatClock(attempt.timeLimitSeconds)}
          </span>
        </div>
        <div className="relative mt-4 h-2 rounded-full bg-raised">
          <div
            className={`h-full rounded-full ${attempt.passed ? "bg-success" : "bg-danger"}`}
            style={{ width: `${attempt.scorePct}%` }}
          />
          <div
            className="absolute -top-1 h-4 w-0.5 bg-warning"
            style={{ left: `${PASS_THRESHOLD}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          {attempt.passed
            ? "Above the bar under exam conditions — that's the signal that counts."
            : `${PASS_THRESHOLD - attempt.scorePct} points short. The per-task feedback below says exactly where they went.`}
        </p>
      </section>

      {/* Per-domain */}
      <section className="rounded-xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Points by domain
        </h2>
        <div className="space-y-4">
          {byDomain.map(({ domain, total, earned }) => (
            <div key={domain.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{domain.shortName}</span>
                <span className="font-mono text-xs text-muted">
                  {earned} / {total} pts
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${total === 0 ? 0 : (earned / total) * 100}%`,
                    backgroundColor: domain.chartColor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Task breakdown */}
      <section className="rounded-xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Task breakdown
        </h2>
        <ul className="space-y-3">
          {attempt.results.map((r, i) => (
            <li
              key={r.exerciseId}
              className={`rounded-lg border p-4 ${
                r.passed ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
              }`}
            >
              <div className="flex items-center gap-3">
                {r.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-danger" />
                )}
                <span className="font-mono text-xs text-faint">#{i + 1}</span>
                <span className="text-sm font-medium">{r.title}</span>
                <span className="flex-1" />
                <span className="font-mono text-xs text-muted">
                  {r.passed ? r.points : 0}/{r.points} pts
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{r.feedback}</p>
              {!r.passed ? (
                <Link
                  href={`/practice/${r.domainId}/${r.exerciseId}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  Drill this task with hints
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/exam"
        className="inline-flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-muted transition-colors hover:text-ink"
      >
        <RotateCcw className="h-4 w-4" />
        Back to Mock Exam
      </Link>
    </div>
  );
}
