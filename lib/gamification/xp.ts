/**
 * XP economy. Level curve: level = floor(sqrt(xp / 50)) + 1 — early levels
 * come fast (50, 200, 450, 800 XP…), later ones stretch out.
 */

export const XP_PER_LESSON = 30;
export const XP_PER_QUIZ_QUESTION = 10;
export const XP_QUIZ_HIGHSCORE_BONUS = 20;
/** Non-final hints each cost a little; the final hint (full solution) costs half the exercise's points. */
export const XP_HINT_COST = 5;
export const MIN_EXERCISE_XP = 10;
/** Finish within half the time budget → bonus. */
export const SPEED_BONUS_RATIO = 0.5;

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return 50 * (level - 1) ** 2;
}

export function levelProgress(xp: number): {
  level: number;
  intoLevel: number;
  levelSpan: number;
  ratio: number;
} {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    intoLevel: xp - floor,
    levelSpan: ceil - floor,
    ratio: (xp - floor) / (ceil - floor),
  };
}

export interface ExerciseXpInput {
  points: number;
  totalHints: number;
  hintsUsed: number;
  timeSeconds: number;
  timeBudgetSeconds: number;
}

export function exerciseXp({
  points,
  totalHints,
  hintsUsed,
  timeSeconds,
  timeBudgetSeconds,
}: ExerciseXpInput): { xp: number; speedBonus: boolean } {
  let xp = points;
  const usedSolution = totalHints > 0 && hintsUsed >= totalHints;
  const cheapHints = usedSolution ? hintsUsed - 1 : hintsUsed;
  xp -= cheapHints * XP_HINT_COST;
  if (usedSolution) xp -= Math.floor(points / 2);
  xp = Math.max(MIN_EXERCISE_XP, xp);

  const speedBonus =
    hintsUsed === 0 && timeSeconds <= timeBudgetSeconds * SPEED_BONUS_RATIO;
  if (speedBonus) xp += Math.round(points * 0.25);
  return { xp, speedBonus };
}

export function quizXp(correct: number, isNewBest: boolean, pct: number): number {
  if (!isNewBest) return 0;
  return correct * XP_PER_QUIZ_QUESTION + (pct >= 80 ? XP_QUIZ_HIGHSCORE_BONUS : 0);
}
