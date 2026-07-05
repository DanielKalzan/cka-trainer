"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ListChecks, Play, XCircle } from "lucide-react";
import { MOCK_EXAMS } from "@/content/mock-exams";
import { DOMAINS, PASS_THRESHOLD } from "@/lib/constants/domains";
import { getExerciseById } from "@/lib/content/registry";
import { overallReadiness } from "@/lib/gamification/readiness";
import { useExamStore } from "@/store/useExamStore";
import { useProgressStore } from "@/store/useProgressStore";
import ExamRunner from "./ExamRunner";

export default function ExamHome() {
  const [runningExamId, setRunningExamId] = useState<string | null>(null);
  const attempts = useExamStore((s) => s.attempts);
  const progress = useProgressStore();
  const readiness = overallReadiness(progress);

  if (runningExamId) return <ExamRunner examId={runningExamId} />;

  const history = Object.values(attempts).sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6">
      {MOCK_EXAMS.map((exam) => {
        const taskCountByDomain = DOMAINS.map((d) => ({
          domain: d,
          count: exam.taskIds.filter((id) => getExerciseById(id)?.domainId === d.id).length,
        })).filter((e) => e.count > 0);
        return (
          <section key={exam.id} className="rounded-xl border border-edge bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{exam.title}</h2>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {exam.durationMinutes} minutes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4" />
                    {exam.taskIds.length} tasks · pass at {PASS_THRESHOLD}%
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {taskCountByDomain.map(({ domain, count }) => (
                    <span
                      key={domain.id}
                      className="flex items-center gap-1.5 font-mono text-xs text-muted"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: domain.chartColor }}
                      />
                      {domain.shortName} ×{count}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setRunningExamId(exam.id)}
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                <Play className="h-4 w-4" />
                Start exam
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">
              Exam conditions: one countdown for all tasks, no hints, no feedback until you end the
              exam. The task mix follows the real exam&apos;s domain weights.
              {readiness > 0
                ? ` Your readiness score says ${readiness}% — this is the reality check.`
                : ""}
            </p>
          </section>
        );
      })}

      <section className="rounded-xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Past attempts
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-faint">No attempts yet. The first one is always the scariest.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/exam/results/${a.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-edge px-4 py-3 text-sm transition-colors hover:border-faint"
                >
                  {a.passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <span className={`font-mono font-semibold ${a.passed ? "text-success" : "text-danger"}`}>
                    {a.scorePct}%
                  </span>
                  <span className="text-muted group-hover:text-ink">{a.examTitle}</span>
                  <span className="flex-1" />
                  <span className="font-mono text-xs text-faint">
                    {new Date(a.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
