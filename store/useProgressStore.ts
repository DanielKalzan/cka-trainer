"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DomainId } from "@/lib/constants/domains";
import { newlyEarnedBadges } from "@/lib/gamification/badges";
import { todayKey } from "@/lib/gamification/streak";
import { EMPTY_PROGRESS, type ProgressData } from "@/lib/gamification/types";
import {
  exerciseXp,
  levelForXp,
  quizXp,
  XP_PER_LESSON,
} from "@/lib/gamification/xp";

export interface FeedbackEvent {
  id: number;
  type: "xp" | "badge" | "levelup";
  text: string;
}

interface ExercisePassInput {
  id: string;
  domainId: DomainId;
  points: number;
  totalHints: number;
  timeBudgetSeconds: number;
  timeSeconds: number;
  hintsUsed: number;
}

interface ProgressStore extends ProgressData {
  /** Transient feedback queue (not persisted). */
  events: FeedbackEvent[];
  completeLesson: (lessonId: string) => void;
  recordQuizRun: (domainId: DomainId, correct: number, total: number) => void;
  recordExercisePass: (input: ExercisePassInput) => void;
  dismissEvent: (id: number) => void;
  resetProgress: () => void;
}

let eventSeq = 1;

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => {
      /** Apply a mutation, then handle XP delta, level-ups, new badges and activity in one place. */
      function commit(mutate: (draft: ProgressData) => ProgressData, xpEvents: string[]) {
        const before = get();
        const levelBefore = levelForXp(before.xp);
        const mutated = mutate({
          xp: before.xp,
          lessonsCompleted: before.lessonsCompleted,
          quizBest: before.quizBest,
          exercisesPassed: before.exercisesPassed,
          activityDates: before.activityDates,
          badges: before.badges,
        });
        const today = todayKey();
        const withActivity: ProgressData = {
          ...mutated,
          activityDates: mutated.activityDates.includes(today)
            ? mutated.activityDates
            : [...mutated.activityDates, today],
        };

        const events: FeedbackEvent[] = xpEvents.map((text) => ({
          id: eventSeq++,
          type: "xp",
          text,
        }));
        const levelAfter = levelForXp(withActivity.xp);
        if (levelAfter > levelBefore) {
          events.push({ id: eventSeq++, type: "levelup", text: `Level ${levelAfter}!` });
        }
        const earned = newlyEarnedBadges(withActivity);
        const badges = { ...withActivity.badges };
        for (const b of earned) {
          badges[b.id] = new Date().toISOString();
          events.push({ id: eventSeq++, type: "badge", text: `Badge earned: ${b.name}` });
        }

        set({ ...withActivity, badges, events: [...before.events, ...events] });
      }

      return {
        ...EMPTY_PROGRESS,
        events: [],

        completeLesson: (lessonId) => {
          if (get().lessonsCompleted[lessonId]) return;
          commit(
            (p) => ({
              ...p,
              xp: p.xp + XP_PER_LESSON,
              lessonsCompleted: {
                ...p.lessonsCompleted,
                [lessonId]: new Date().toISOString(),
              },
            }),
            [`+${XP_PER_LESSON} XP — lesson complete`],
          );
        },

        recordQuizRun: (domainId, correct, total) => {
          if (total === 0) return;
          const pct = Math.round((correct / total) * 100);
          const prev = get().quizBest[domainId];
          const isNewBest = !prev || pct > prev.pct;
          const gained = quizXp(correct, isNewBest, pct);
          commit(
            (p) => ({
              ...p,
              xp: p.xp + gained,
              quizBest: isNewBest
                ? {
                    ...p.quizBest,
                    [domainId]: { correct, total, pct, at: new Date().toISOString() },
                  }
                : p.quizBest,
            }),
            gained > 0 ? [`+${gained} XP — quiz ${pct}%${prev ? " (new best)" : ""}`] : [],
          );
        },

        recordExercisePass: (input) => {
          if (get().exercisesPassed[input.id]) {
            // Repeat pass: keep the better time, no re-award
            const prev = get().exercisesPassed[input.id];
            if (input.timeSeconds < prev.timeSeconds && input.hintsUsed === 0) {
              commit(
                (p) => ({
                  ...p,
                  exercisesPassed: {
                    ...p.exercisesPassed,
                    [input.id]: { ...prev, timeSeconds: input.timeSeconds, hintsUsed: 0 },
                  },
                }),
                [],
              );
            }
            return;
          }
          const { xp, speedBonus } = exerciseXp({
            points: input.points,
            totalHints: input.totalHints,
            hintsUsed: input.hintsUsed,
            timeSeconds: input.timeSeconds,
            timeBudgetSeconds: input.timeBudgetSeconds,
          });
          commit(
            (p) => ({
              ...p,
              xp: p.xp + xp,
              exercisesPassed: {
                ...p.exercisesPassed,
                [input.id]: {
                  domainId: input.domainId,
                  timeSeconds: input.timeSeconds,
                  timeBudgetSeconds: input.timeBudgetSeconds,
                  hintsUsed: input.hintsUsed,
                  xpAwarded: xp,
                  at: new Date().toISOString(),
                },
              },
            }),
            [`+${xp} XP — exercise passed${speedBonus ? " (speed bonus!)" : ""}`],
          );
        },

        dismissEvent: (id) => set({ events: get().events.filter((e) => e.id !== id) }),

        resetProgress: () => set({ ...EMPTY_PROGRESS, events: [] }),
      };
    },
    {
      name: "cka-progress",
      version: 1,
      // SSR renders defaults; rehydrate after mount (StoreHydrator) to avoid hydration mismatch.
      skipHydration: true,
      partialize: (s) => ({
        xp: s.xp,
        lessonsCompleted: s.lessonsCompleted,
        quizBest: s.quizBest,
        exercisesPassed: s.exercisesPassed,
        activityDates: s.activityDates,
        badges: s.badges,
      }),
    },
  ),
);
