import type { DomainId } from "@/lib/constants/domains";
import type { ClusterState } from "@/lib/terminal-engine/cluster-state";

/**
 * Content model. Everything here is data — adding content never requires
 * touching component code.
 */

export interface LessonTip {
  /** 'deep-dive' renders collapsed/optional in the UI — context, not required memorization. */
  type: "exam-tip" | "deep-dive";
  text: string;
}

export interface Lesson {
  id: string;
  domainId: DomainId;
  title: string;
  estMinutes: number;
  /** Markdown. Written for an intermediate audience — no Kubernetes 101. */
  body: string;
  tips: LessonTip[];
}

export type QuizQuestionType = "multiple-choice" | "command-fill" | "yaml-fix";

export interface QuizQuestion {
  id: string;
  domainId: DomainId;
  type: QuizQuestionType;
  /** For 'yaml-fix', include the broken YAML in a fenced block inside the prompt (markdown). */
  prompt: string;
  /** Present for 'multiple-choice' only. */
  options?: string[];
  /**
   * multiple-choice: the exact text of the correct option.
   * command-fill / yaml-fix: the canonical answer; graded leniently (whitespace-insensitive,
   * common flag aliases accepted via `acceptableAnswers`).
   */
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
}

export interface CheckResult {
  passed: boolean;
  feedback: string;
}

export type ExerciseDifficulty = "easy" | "medium" | "hard";

/** Cluster-scoped objects an exercise leads the user to create — namespace
 *  deletion won't remove these, so the session teardown deletes them by name. */
export interface ClusterScopedRef {
  kind: "PersistentVolume" | "StorageClass" | "ClusterRole" | "ClusterRoleBinding";
  name: string;
}

/**
 * Marks an exercise as running against the real kind cluster. The bridge
 * creates a dedicated namespace per session; the checker for this exercise id
 * lives server-side in /lib/checkers (content stays client-importable).
 */
export interface LiveExerciseConfig {
  /** Setup manifest applied into the session namespace, path relative to repo root. */
  manifest?: string;
  /** Node-level scenario id under /scripts/scenarios (setup/teardown scripts). */
  scenario?: string;
  clusterScopedCleanup?: ClusterScopedRef[];
}

export interface TerminalExercise {
  id: string;
  domainId: DomainId;
  title: string;
  /** Exam-style task text (markdown). */
  scenario: string;
  /** @deprecated sim-terminal state — removed once all domains + exam run live. */
  initialState: ClusterState;
  /** Progressively more revealing. Index 0 is cheapest; last entry is the full solution. */
  hints: string[];
  /**
   * Grades the RESULTING cluster state — never string-match typed commands;
   * troubleshooting tasks have multiple valid solution paths.
   * @deprecated sim checker — live exercises are graded server-side via /lib/checkers.
   */
  checker: (state: ClusterState) => CheckResult;
  /** Present once the exercise is migrated to the real cluster (practice mode
   *  uses it; the mock exam keeps the sim path until its own migration step). */
  live?: LiveExerciseConfig;
  /** Pacing feedback: "real exam gives you ~N min for this". */
  timeBudgetSeconds: number;
  points: number;
  difficulty: ExerciseDifficulty;
}

export interface MockExam {
  id: string;
  title: string;
  durationMinutes: number;
  /** Terminal-exercise ids, pulled proportionally to real domain weights. */
  taskIds: string[];
}

/** Everything one domain contributes, exported from /content/<slug>/index.ts. */
export interface DomainContent {
  domainId: DomainId;
  lessons: Lesson[];
  quiz: QuizQuestion[];
  exercises: TerminalExercise[];
}
