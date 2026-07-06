/** Fisher-Yates shuffle. Returns a new array; never mutates the input. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shuffles and takes the first n. If arr has fewer than n items, returns all
 * of them, shuffled — never pads, never throws.
 */
export function pickRandom<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, n));
}
