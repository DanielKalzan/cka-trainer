"use client";

import { useState } from "react";
import { Check, ChevronRight, Eye, X } from "lucide-react";
import type { QuizQuestion } from "@/lib/types/content";
import MarkdownView from "@/components/MarkdownView";
import { useProgressStore } from "@/store/useProgressStore";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTextAnswerCorrect(q: QuizQuestion, answer: string): boolean {
  const candidates = [q.correctAnswer, ...(q.acceptableAnswers ?? [])];
  return candidates.some((c) => normalize(c) === normalize(answer));
}

type Result = { correct: boolean; revealed: boolean };

export default function QuizRunner({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const recordQuizRun = useProgressStore((s) => s.recordQuizRun);

  const q = questions[index];

  function submit() {
    if (result) return;
    const correct =
      q.type === "multiple-choice"
        ? selected === q.correctAnswer
        : isTextAnswerCorrect(q, typed);
    if (correct) setScore((s) => s + 1);
    setResult({ correct, revealed: false });
  }

  function reveal() {
    setResult({ correct: false, revealed: true });
  }

  function next() {
    if (index + 1 >= questions.length) {
      recordQuizRun(questions[0].domainId, score, questions.length);
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setTyped("");
    setResult(null);
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center">
        <div className="font-mono text-4xl font-bold">{pct}%</div>
        <p className="mt-2 text-muted">
          {score} / {questions.length} correct
        </p>
        <button
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setTyped("");
            setResult(null);
            setScore(0);
            setDone(false);
          }}
          className="mt-6 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Retry quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {index + 1} / {questions.length}
        </span>
        <span className="font-mono">{score} correct</span>
      </div>

      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="text-sm">
          <MarkdownView>{q.prompt}</MarkdownView>
        </div>

        {q.type === "multiple-choice" && q.options ? (
          <div className="mt-4 space-y-2">
            {q.options.map((opt) => {
              const isChosen = selected === opt;
              const isCorrect = result && opt === q.correctAnswer;
              const isWrongPick = result && isChosen && opt !== q.correctAnswer;
              return (
                <button
                  key={opt}
                  disabled={!!result}
                  onClick={() => setSelected(opt)}
                  className={`block w-full rounded-lg border px-4 py-3 text-left font-mono text-[13px] transition-colors ${
                    isCorrect
                      ? "border-success/60 bg-success/10 text-ink"
                      : isWrongPick
                        ? "border-danger/60 bg-danger/10 text-ink"
                        : isChosen
                          ? "border-accent bg-accent/10 text-ink"
                          : "border-edge bg-raised/40 text-ink/80 hover:border-faint"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <textarea
            value={typed}
            disabled={!!result}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={q.type === "command-fill" ? "type the command / path…" : "describe the fix…"}
            rows={2}
            className="mt-4 w-full rounded-lg border border-edge bg-term-bg p-3 font-mono text-[13px] text-term-green outline-none placeholder:text-faint focus:border-accent"
          />
        )}

        {result ? (
          <div
            className={`mt-4 rounded-lg border p-4 text-sm ${
              result.correct
                ? "border-success/40 bg-success/5"
                : "border-danger/40 bg-danger/5"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2 font-medium">
              {result.correct ? (
                <>
                  <Check className="h-4 w-4 text-success" /> Correct
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-danger" />
                  {result.revealed ? "Answer revealed" : "Not quite"}
                </>
              )}
            </div>
            {!result.correct ? (
              <p className="mb-2 font-mono text-[13px] text-term-green">{q.correctAnswer}</p>
            ) : null}
            <p className="leading-relaxed text-ink/85">{q.explanation}</p>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        {!result && q.type !== "multiple-choice" ? (
          <button
            onClick={reveal}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-4 py-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <Eye className="h-4 w-4" /> Show answer
          </button>
        ) : null}
        {result ? (
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            {index + 1 >= questions.length ? "Finish" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={q.type === "multiple-choice" ? !selected : typed.trim() === ""}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Check
          </button>
        )}
      </div>
    </div>
  );
}
