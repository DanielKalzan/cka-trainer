"use client";

import { useEffect, useRef, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Lightbulb,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { DomainId } from "@/lib/constants/domains";
import { getExercise } from "@/lib/content/registry";
import type { ClusterState } from "@/lib/terminal-engine/cluster-state";
import type { CheckResult, TerminalExercise } from "@/lib/types/content";
import MarkdownView from "@/components/MarkdownView";
import { useProgressStore } from "@/store/useProgressStore";
import Terminal from "./Terminal";
import LiveTerminal, { type LiveTerminalHandle } from "./LiveTerminal";

interface ExerciseRunnerProps {
  domainId: DomainId;
  exerciseId: string;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ExerciseRunner({ domainId, exerciseId }: ExerciseRunnerProps) {
  const exercise = getExercise(domainId, exerciseId);
  if (!exercise) throw new Error(`unknown exercise ${domainId}/${exerciseId}`);

  // Migrated exercises run against the real kind cluster; the rest still use
  // the sim terminal until their domain is converted (then the sim path goes).
  return exercise.live ? (
    <LiveRunner key={exerciseId} exercise={exercise} />
  ) : (
    <Runner key={exerciseId} exercise={exercise} />
  );
}

/** Runner for real-cluster exercises. Grading is async: the check request goes
 *  over the terminal's WebSocket and the verdict comes back via callback. */
function LiveRunner({ exercise }: { exercise: TerminalExercise }) {
  const terminalRef = useRef<LiveTerminalHandle>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const recordExercisePass = useProgressStore((s) => s.recordExercisePass);

  // Exam-pace clock starts once the namespace is provisioned, not on page load.
  useEffect(() => {
    if (!ready || finishedAt !== null) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [ready, finishedAt, sessionKey]);

  function check() {
    if (!terminalRef.current?.requestCheck()) {
      setResult({ passed: false, feedback: "Terminal isn't connected — reconnect and try again." });
      return;
    }
    setChecking(true);
  }

  function onCheckResult(verdict: CheckResult) {
    setChecking(false);
    setResult(verdict);
    if (verdict.passed && finishedAt === null) {
      setFinishedAt(elapsed);
      recordExercisePass({
        id: exercise.id,
        domainId: exercise.domainId,
        points: exercise.points,
        totalHints: exercise.hints.length,
        timeBudgetSeconds: exercise.timeBudgetSeconds,
        timeSeconds: elapsed,
        hintsUsed: hintsShown,
      });
    }
  }

  function reset() {
    setResult(null);
    setElapsed(0);
    setFinishedAt(null);
    setReady(false);
    setChecking(false);
    setSessionKey((k) => k + 1); // remount = fresh namespace server-side
  }

  const budget = exercise.timeBudgetSeconds;
  const overBudget = elapsed > budget && finishedAt === null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-edge bg-surface p-5 text-sm">
        <MarkdownView>{exercise.scenario}</MarkdownView>
      </section>

      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
            overBudget ? "border-danger/50 text-danger" : "border-edge text-muted"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {formatClock(finishedAt ?? elapsed)} / {formatClock(budget)} exam pace
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted">
          <Award className="h-3.5 w-3.5" />
          {exercise.points} pts
        </span>
        <span className="flex-1" />
        {hintsShown < exercise.hints.length ? (
          <button
            onClick={() => setHintsShown((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted transition-colors hover:text-warning"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            hint {hintsShown + 1}/{exercise.hints.length}
            {hintsShown + 1 === exercise.hints.length ? " (solution)" : ""}
          </button>
        ) : null}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          reset
        </button>
        <button
          onClick={check}
          disabled={!ready || checking}
          className="rounded-lg bg-accent px-4 py-1.5 font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {checking ? "checking…" : "check result"}
        </button>
      </div>

      {hintsShown > 0 ? (
        <div className="space-y-2">
          {exercise.hints.slice(0, hintsShown).map((hint, i) => (
            <div
              key={i}
              className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"
            >
              <span className="mr-2 font-mono text-xs text-warning">hint {i + 1}</span>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">{hint}</pre>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <div
          className={`flex gap-3 rounded-lg border p-4 text-sm ${
            result.passed
              ? "border-success/50 bg-success/10"
              : "border-danger/50 bg-danger/10"
          }`}
        >
          {result.passed ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-danger" />
          )}
          <div>
            <div className="font-medium">
              {result.passed
                ? `Passed${finishedAt !== null ? ` in ${formatClock(finishedAt)}` : ""}${
                    finishedAt !== null && finishedAt <= budget ? " — within exam pace" : ""
                  }`
                : "Not yet"}
            </div>
            <p className="mt-1 leading-relaxed text-ink/85">{result.feedback}</p>
          </div>
        </div>
      ) : null}

      <LiveTerminal
        key={sessionKey}
        ref={terminalRef}
        exerciseId={exercise.id}
        onReady={() => setReady(true)}
        onCheckResult={onCheckResult}
      />
    </div>
  );
}

function Runner({ exercise }: { exercise: NonNullable<ReturnType<typeof getExercise>> }) {
  const clusterRef = useRef<ClusterState>(structuredClone(exercise.initialState));
  const [sessionKey, setSessionKey] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const recordExercisePass = useProgressStore((s) => s.recordExercisePass);

  useEffect(() => {
    if (finishedAt !== null) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [finishedAt, sessionKey]);

  function check() {
    const verdict = exercise.checker(clusterRef.current);
    setResult(verdict);
    if (verdict.passed && finishedAt === null) {
      setFinishedAt(elapsed);
      recordExercisePass({
        id: exercise.id,
        domainId: exercise.domainId,
        points: exercise.points,
        totalHints: exercise.hints.length,
        timeBudgetSeconds: exercise.timeBudgetSeconds,
        timeSeconds: elapsed,
        hintsUsed: hintsShown,
      });
    }
  }

  function reset() {
    clusterRef.current = structuredClone(exercise.initialState);
    setResult(null);
    setElapsed(0);
    setFinishedAt(null);
    setSessionKey((k) => k + 1);
  }

  const budget = exercise.timeBudgetSeconds;
  const overBudget = elapsed > budget && finishedAt === null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-edge bg-surface p-5 text-sm">
        <MarkdownView>{exercise.scenario}</MarkdownView>
      </section>

      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
            overBudget ? "border-danger/50 text-danger" : "border-edge text-muted"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {formatClock(finishedAt ?? elapsed)} / {formatClock(budget)} exam pace
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted">
          <Award className="h-3.5 w-3.5" />
          {exercise.points} pts
        </span>
        <span className="flex-1" />
        {hintsShown < exercise.hints.length ? (
          <button
            onClick={() => setHintsShown((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted transition-colors hover:text-warning"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            hint {hintsShown + 1}/{exercise.hints.length}
            {hintsShown + 1 === exercise.hints.length ? " (solution)" : ""}
          </button>
        ) : null}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-muted transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          reset
        </button>
        <button
          onClick={check}
          className="rounded-lg bg-accent px-4 py-1.5 font-medium text-bg transition-opacity hover:opacity-90"
        >
          check result
        </button>
      </div>

      {hintsShown > 0 ? (
        <div className="space-y-2">
          {exercise.hints.slice(0, hintsShown).map((hint, i) => (
            <div
              key={i}
              className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"
            >
              <span className="mr-2 font-mono text-xs text-warning">hint {i + 1}</span>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">{hint}</pre>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <div
          className={`flex gap-3 rounded-lg border p-4 text-sm ${
            result.passed
              ? "border-success/50 bg-success/10"
              : "border-danger/50 bg-danger/10"
          }`}
        >
          {result.passed ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-danger" />
          )}
          <div>
            <div className="font-medium">
              {result.passed
                ? `Passed${finishedAt !== null ? ` in ${formatClock(finishedAt)}` : ""}${
                    finishedAt !== null && finishedAt <= budget ? " — within exam pace" : ""
                  }`
                : "Not yet"}
            </div>
            <p className="mt-1 leading-relaxed text-ink/85">{result.feedback}</p>
          </div>
        </div>
      ) : null}

      <Terminal
        key={sessionKey}
        clusterRef={clusterRef}
        welcome={`Connected to exam cluster. Task loaded: ${exercise.title}\nType 'help' for supported commands.`}
      />
    </div>
  );
}
