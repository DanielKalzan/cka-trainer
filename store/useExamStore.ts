"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DomainId } from "@/lib/constants/domains";

export interface ExamTaskResult {
  exerciseId: string;
  domainId: DomainId;
  title: string;
  points: number;
  passed: boolean;
  feedback: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  /** ISO date the attempt finished. */
  at: string;
  timeUsedSeconds: number;
  timeLimitSeconds: number;
  results: ExamTaskResult[];
  /** Points-weighted percentage, 0–100. */
  scorePct: number;
  passed: boolean;
}

interface ExamStore {
  attempts: Record<string, ExamAttempt>;
  recordAttempt: (attempt: ExamAttempt) => void;
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      attempts: {},
      recordAttempt: (attempt) =>
        set({ attempts: { ...get().attempts, [attempt.id]: attempt } }),
    }),
    {
      name: "cka-exam-attempts",
      version: 1,
      // Same SSR strategy as the progress store: defaults on the server,
      // rehydrated after mount by StoreHydrator.
      skipHydration: true,
    },
  ),
);
