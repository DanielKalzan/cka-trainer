/** Streak logic. Dates are local-time YYYY-MM-DD strings. */

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return todayKey(date);
}

/**
 * Consecutive active days ending today — or ending yesterday, so the streak
 * isn't shown as dead before you've studied today. Only a full missed day
 * breaks it.
 */
export function currentStreak(activityDates: string[], now: Date = new Date()): number {
  const days = new Set(activityDates);
  const today = todayKey(now);
  let cursor = days.has(today) ? today : shiftDays(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

/** Last n days as {key, active}, oldest first — for the dot calendar. */
export function recentActivity(
  activityDates: string[],
  n: number,
  now: Date = new Date(),
): { key: string; active: boolean }[] {
  const days = new Set(activityDates);
  const today = todayKey(now);
  const out: { key: string; active: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftDays(today, -i);
    out.push({ key, active: days.has(key) });
  }
  return out;
}
