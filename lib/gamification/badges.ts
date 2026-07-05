import {
  Database,
  Flame,
  Gauge,
  GraduationCap,
  Target,
  Terminal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ProgressData } from "./types";
import { currentStreak } from "./streak";
import { levelForXp, SPEED_BONUS_RATIO } from "./xp";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  check: (p: ProgressData) => boolean;
}

export const BADGES: readonly BadgeDef[] = [
  {
    id: "first-lesson",
    name: "Syllabus Opened",
    description: "Complete your first lesson.",
    icon: GraduationCap,
    check: (p) => Object.keys(p.lessonsCompleted).length >= 1,
  },
  {
    id: "first-exercise",
    name: "Hands On",
    description: "Pass your first terminal exercise.",
    icon: Terminal,
    check: (p) => Object.keys(p.exercisesPassed).length >= 1,
  },
  {
    id: "etcd-master",
    name: "etcd Master",
    description: "Pass the etcd backup & restore exercise without hints.",
    icon: Database,
    check: (p) => {
      const r = p.exercisesPassed["ca-ex-etcd-backup-restore"];
      return !!r && r.hintsUsed === 0;
    },
  },
  {
    id: "speed-runner",
    name: "Speed Runner",
    description: "Finish any exercise in under half its time budget, no hints.",
    icon: Gauge,
    check: (p) =>
      Object.values(p.exercisesPassed).some(
        (r) => r.hintsUsed === 0 && r.timeSeconds <= r.timeBudgetSeconds * SPEED_BONUS_RATIO,
      ),
  },
  {
    id: "quiz-perfect",
    name: "Flawless",
    description: "Score 100% on a domain quiz.",
    icon: Target,
    check: (p) => Object.values(p.quizBest).some((q) => q !== undefined && q.pct === 100),
  },
  {
    id: "streak-7",
    name: "7-Day Streak",
    description: "Practice seven days in a row.",
    icon: Flame,
    check: (p) => currentStreak(p.activityDates) >= 7,
  },
  {
    id: "level-5",
    name: "Seasoned Operator",
    description: "Reach level 5.",
    icon: Zap,
    check: (p) => levelForXp(p.xp) >= 5,
  },
] as const;

/** Badge ids earned by `p` that aren't recorded yet. */
export function newlyEarnedBadges(p: ProgressData): BadgeDef[] {
  return BADGES.filter((b) => p.badges[b.id] === undefined && b.check(p));
}
