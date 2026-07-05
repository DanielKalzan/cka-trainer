import type { DomainId } from "@/lib/constants/domains";

/** Persisted progress shape. Pure data — everything derivable is computed by lib/gamification functions. */

export interface QuizRecord {
  correct: number;
  total: number;
  pct: number;
  at: string;
}

export interface ExerciseRecord {
  domainId: DomainId;
  timeSeconds: number;
  timeBudgetSeconds: number;
  hintsUsed: number;
  xpAwarded: number;
  at: string;
}

export interface ProgressData {
  xp: number;
  /** lessonId → ISO date completed */
  lessonsCompleted: Record<string, string>;
  /** domainId → best quiz run */
  quizBest: Partial<Record<DomainId, QuizRecord>>;
  /** exerciseId → first passing run */
  exercisesPassed: Record<string, ExerciseRecord>;
  /** YYYY-MM-DD days with any activity */
  activityDates: string[];
  /** badgeId → ISO date earned */
  badges: Record<string, string>;
}

export const EMPTY_PROGRESS: ProgressData = {
  xp: 0,
  lessonsCompleted: {},
  quizBest: {},
  exercisesPassed: {},
  activityDates: [],
  badges: {},
};
