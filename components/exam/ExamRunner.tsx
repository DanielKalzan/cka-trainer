"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, Clock, Flag, RotateCcw } from "lucide-react";
import { getMockExam } from "@/content/mock-exams";
import { getDomain, PASS_THRESHOLD } from "@/lib/constants/domains";
import { getExerciseById } from "@/lib/content/registry";
import type { CheckResult, TerminalExercise } from "@/lib/types/content";
import { useExamStore, type ExamTaskResult } from "@/store/useExamStore";
import DomainBadge from "@/components/DomainBadge";
import MarkdownView from "@/components/MarkdownView";
import LiveTerminal, { type LiveTerminalHandle } from "@/components/terminal/LiveTerminal";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ExamRunner({ examId }: { examId: string }) {
  const exam = getMockExam(examId);
  if (!exam) throw new Error(`unknown mock exam ${examId}`);
  const exercises = exam.taskIds
    .map((id) => getExerciseById(id))
    .filter((e): e is TerminalExercise => e !== undefined);
  // A taskId that doesn't resolve to an exercise (typo, removed content) is
  // dropped by the filter above. Surface the miscount instead of silently
  // running a short exam, and don't render Runner with zero tasks — it indexes
  // exercises[0] and would crash.
  if (exercises.length < exam.taskIds.length) {
    console.warn(
      `[exam ${examId}] ${exam.taskIds.length - exercises.length} of ${exam.taskIds.length} tasks reference unknown exercises and were skipped.`,
    );
  }
  if (exercises.length === 0) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center text-muted">
        This mock exam has no runnable tasks — its exercise references are missing.
      </div>
    );
  }
  return <Runner key={examId} exam={exam} exercises={exercises} />;
}

function Runner({
  exam,
  exercises,
}: {
  exam: NonNullable<ReturnType<typeof getMockExam>>;
  exercises: TerminalExercise[];
}) {
  const router = useRouter();
  const recordAttempt = useExamStore((s) => s.recordAttempt);

  const timeLimit = exam.durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [taskIndex, setTaskIndex] = useState(0);
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [grading, setGrading] = useState(false);
  const finishedRef = useRef(false);

  // One live cluster session per task, created lazily on first visit and kept
  // mounted (hidden) while you work elsewhere — its namespace lives as long as
  // the terminal's WebSocket does, so switching tasks preserves state.
  const [visited, setVisited] = useState<Record<string, boolean>>({
    [exercises[0]?.id]: true,
  });
  const handlesRef = useRef<Record<string, LiveTerminalHandle | null>>({});

  async function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGrading(true);
    const results: ExamTaskResult[] = await Promise.all(
      exercises.map(async (ex) => {
        const handle = handlesRef.current[ex.id];
        const verdict: CheckResult = handle
          ? await handle.check()
          : { passed: false, feedback: "Not attempted — this task's environment was never opened." };
        return {
          exerciseId: ex.id,
          domainId: ex.domainId,
          title: ex.title,
          points: ex.points,
          passed: verdict.passed,
          feedback: verdict.feedback,
        };
      }),
    );
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const earned = results.filter((r) => r.passed).reduce((sum, r) => sum + r.points, 0);
    const scorePct = totalPoints === 0 ? 0 : Math.round((earned / totalPoints) * 100);
    const attemptId = `${exam.id}-${Date.now()}`;
    recordAttempt({
      id: attemptId,
      examId: exam.id,
      examTitle: exam.title,
      at: new Date().toISOString(),
      timeUsedSeconds: timeLimit - timeLeft,
      timeLimitSeconds: timeLimit,
      results,
      scorePct,
      passed: scorePct >= PASS_THRESHOLD,
    });
    // Navigating away unmounts every terminal → sessions close → the bridge
    // tears down all task namespaces. Attempt-wide cleanup for free.
    router.push(`/exam/results/${attemptId}`);
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void finishRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const ex = exercises[taskIndex];
  const lowTime = timeLeft <= 300;

  return (
    <div className="space-y-4">
      {/* Exam header: timer + task nav + end */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm ${
            lowTime ? "border-danger/60 bg-danger/10 text-danger" : "border-edge text-ink"
          }`}
        >
          <Clock className="h-4 w-4" />
          {formatClock(timeLeft)}
        </span>
        <div className="flex gap-1.5">
          {exercises.map((e, i) => {
            const domain = getDomain(e.domainId);
            return (
              <button
                key={e.id}
                onClick={() => {
                  setTaskIndex(i);
                  setVisited((v) => ({ ...v, [e.id]: true }));
                }}
                title={`${domain?.shortName}: ${e.title}`}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-xs transition-colors ${
                  i === taskIndex
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-edge text-muted hover:border-faint hover:text-ink"
                }`}
              >
                <span
                  className="mr-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: domain?.chartColor }}
                />
                {i + 1}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <button
          onClick={() => {
            if (window.confirm("End the exam and grade all tasks now?")) void finish();
          }}
          disabled={grading}
          className="flex items-center gap-1.5 rounded-lg bg-danger/90 px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Flag className="h-4 w-4" />
          {grading ? "grading…" : "End exam"}
        </button>
      </div>

      {/* Task */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted">
            Task {taskIndex + 1} / {exercises.length}
          </span>
          <DomainBadge domain={getDomain(ex.domainId)!} />
          <span className="flex items-center gap-1 font-mono text-xs text-muted">
            <Award className="h-3.5 w-3.5" />
            {ex.points} pts
          </span>
          <span className="flex-1" />
          <button
            onClick={() => {
              if (window.confirm("Reset this task to its initial state? (fresh namespace)")) {
                setResetKeys((k) => ({ ...k, [ex.id]: (k[ex.id] ?? 0) + 1 }));
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            reset task
          </button>
        </div>
        <h2 className="mt-3 text-lg font-semibold">{ex.title}</h2>
        <div className="mt-2 text-sm">
          <MarkdownView>{ex.scenario}</MarkdownView>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-faint">
        <AlertTriangle className="h-3.5 w-3.5" />
        Exam conditions: no hints, no per-task feedback — everything is graded against the live
        cluster when you end the exam. Switching tasks keeps each task&apos;s namespace alive;
        tasks you never open count as not attempted.
      </p>

      {/* All visited terminals stay mounted (hidden) so their sessions — and
          cluster namespaces — survive task switching. */}
      {exercises.map((e, i) =>
        visited[e.id] ? (
          <div key={e.id} className={i === taskIndex ? "" : "hidden"}>
            <LiveTerminal
              key={resetKeys[e.id] ?? 0}
              ref={(h) => {
                handlesRef.current[e.id] = h;
              }}
              exerciseId={e.id}
            />
          </div>
        ) : null,
      )}

      {grading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80">
          <div className="rounded-xl border border-edge bg-surface px-8 py-6 text-center">
            <p className="font-medium">Grading all tasks against the cluster…</p>
            <p className="mt-1 text-sm text-muted">This takes a few seconds.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
