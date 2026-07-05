"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, Clock, Flag, RotateCcw } from "lucide-react";
import { getMockExam } from "@/content/mock-exams";
import { getDomain } from "@/lib/constants/domains";
import { getExerciseById } from "@/lib/content/registry";
import type { ClusterState } from "@/lib/terminal-engine/cluster-state";
import type { TerminalExercise } from "@/lib/types/content";
import { useExamStore, type ExamTaskResult } from "@/store/useExamStore";
import DomainBadge from "@/components/DomainBadge";
import MarkdownView from "@/components/MarkdownView";
import Terminal from "@/components/terminal/Terminal";

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
  const finishedRef = useRef(false);

  // One cluster state per task, created lazily, survives task switching.
  const statesRef = useRef<Record<string, { current: ClusterState }>>({});
  function stateFor(ex: TerminalExercise): { current: ClusterState } {
    if (!statesRef.current[ex.id]) {
      statesRef.current[ex.id] = { current: structuredClone(ex.initialState) };
    }
    return statesRef.current[ex.id];
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const results: ExamTaskResult[] = exercises.map((ex) => {
      const verdict = ex.checker(stateFor(ex).current);
      return {
        exerciseId: ex.id,
        domainId: ex.domainId,
        title: ex.title,
        points: ex.points,
        passed: verdict.passed,
        feedback: verdict.feedback,
      };
    });
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
      passed: scorePct >= 66,
    });
    router.push(`/exam/results/${attemptId}`);
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          finishRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const ex = exercises[taskIndex];
  const clusterRef = stateFor(ex);
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
                onClick={() => setTaskIndex(i)}
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
            if (window.confirm("End the exam and grade all tasks now?")) finish();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-danger/90 px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          <Flag className="h-4 w-4" />
          End exam
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
              if (window.confirm("Reset this task's cluster to its initial state?")) {
                statesRef.current[ex.id] = { current: structuredClone(ex.initialState) };
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
        Exam conditions: no hints, no per-task feedback — everything is graded when you end the exam.
        Switching tasks keeps each task&apos;s cluster state.
      </p>

      <Terminal
        key={`${ex.id}-${resetKeys[ex.id] ?? 0}`}
        clusterRef={clusterRef}
        welcome={`Task ${taskIndex + 1}: connected to exam cluster.`}
      />
    </div>
  );
}
