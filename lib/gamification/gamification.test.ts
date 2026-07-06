import { describe, expect, it } from "vitest";
import { currentStreak, recentActivity, todayKey } from "./streak";
import {
  exerciseXp,
  levelForXp,
  levelProgress,
  MIN_EXERCISE_XP,
  quizXp,
  XP_HINT_COST,
  xpForLevel,
} from "./xp";

describe("level curve", () => {
  it("levels at the documented thresholds (50, 200, 450, 800…)", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(199)).toBe(2);
    expect(levelForXp(200)).toBe(3);
    expect(levelForXp(800)).toBe(5);
  });

  it("xpForLevel is the inverse of levelForXp at boundaries", () => {
    for (let level = 1; level <= 10; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it("levelProgress ratio stays in [0, 1)", () => {
    for (const xp of [0, 49, 50, 137, 450, 12345]) {
      const p = levelProgress(xp);
      expect(p.ratio).toBeGreaterThanOrEqual(0);
      expect(p.ratio).toBeLessThan(1);
      expect(p.intoLevel + xpForLevel(p.level)).toBe(xp);
    }
  });
});

describe("exercise XP", () => {
  const base = { points: 100, totalHints: 3, timeSeconds: 300, timeBudgetSeconds: 400 };

  it("full points without hints, speed bonus only under half budget", () => {
    expect(exerciseXp({ ...base, hintsUsed: 0 })).toEqual({ xp: 100, speedBonus: false });
    expect(exerciseXp({ ...base, hintsUsed: 0, timeSeconds: 200 })).toEqual({
      xp: 125,
      speedBonus: true,
    });
  });

  it("non-final hints cost XP_HINT_COST each; the solution hint costs half the points", () => {
    expect(exerciseXp({ ...base, hintsUsed: 1 }).xp).toBe(100 - XP_HINT_COST);
    expect(exerciseXp({ ...base, hintsUsed: 2 }).xp).toBe(100 - 2 * XP_HINT_COST);
    // all 3 hints = 2 cheap + solution (floor(100/2))
    expect(exerciseXp({ ...base, hintsUsed: 3 }).xp).toBe(100 - 2 * XP_HINT_COST - 50);
  });

  it("never drops below the minimum", () => {
    expect(
      exerciseXp({ points: 20, totalHints: 5, hintsUsed: 5, timeSeconds: 999, timeBudgetSeconds: 60 }).xp,
    ).toBe(MIN_EXERCISE_XP);
  });

  it("hints forfeit the speed bonus even when fast", () => {
    expect(exerciseXp({ ...base, hintsUsed: 1, timeSeconds: 10 }).speedBonus).toBe(false);
  });
});

describe("quiz XP", () => {
  it("only a new best pays out; 80%+ adds the highscore bonus", () => {
    expect(quizXp(7, false, 70)).toBe(0);
    expect(quizXp(7, true, 70)).toBe(70);
    expect(quizXp(8, true, 80)).toBe(100);
  });
});

describe("streak", () => {
  const now = new Date(2026, 6, 6); // 2026-07-06 local
  const day = (delta: number) => {
    const d = new Date(2026, 6, 6 + delta);
    return todayKey(d);
  };

  it("counts consecutive days ending today", () => {
    expect(currentStreak([day(0), day(-1), day(-2)], now)).toBe(3);
  });

  it("survives 'not studied yet today' — ends yesterday", () => {
    expect(currentStreak([day(-1), day(-2)], now)).toBe(2);
  });

  it("a full missed day breaks it", () => {
    expect(currentStreak([day(-2), day(-3)], now)).toBe(0);
    expect(currentStreak([day(0), day(-2)], now)).toBe(1);
  });

  it("recentActivity returns oldest-first with correct flags", () => {
    const cal = recentActivity([day(0), day(-2)], 3, now);
    expect(cal.map((c) => c.active)).toEqual([true, false, true]);
    expect(cal[2].key).toBe(day(0));
  });
});
