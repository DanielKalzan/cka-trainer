/** Frozen "current time" of the simulator, so ages are deterministic. */
export const SIM_NOW = new Date("2026-07-05T12:00:00Z").getTime();

/** kubectl-style age: 45s, 12m, 3h, 5d, 2y */
export function formatAge(creationTimestamp?: string): string {
  if (!creationTimestamp) return "<unknown>";
  const ms = SIM_NOW - new Date(creationTimestamp).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 365) return `${d}d`;
  return `${Math.floor(d / 365)}y`;
}

/** Left-aligned columns padded with 3 spaces, like kubectl. */
export function formatTable(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((r) => (r[col] ?? "").length)));
  return all
    .map((row) =>
      row
        .map((cell, col) => (col === row.length - 1 ? cell : (cell ?? "").padEnd(widths[col] + 3)))
        .join("")
        .trimEnd(),
    )
    .join("\n");
}

export function formatLabels(labels?: Record<string, string>): string {
  const entries = Object.entries(labels ?? {});
  if (entries.length === 0) return "<none>";
  return entries.map(([k, v]) => (v === "" ? `${k}=` : `${k}=${v}`)).join(",");
}

/** Deterministic pseudo-random suffix, stable per seed — for pod name hashes. */
export function pseudoHash(seed: string, length: number, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    out += alphabet[Math.abs(h) % alphabet.length];
  }
  return out;
}

/** ReplicaSet-style hash (kubectl uses a restricted alphabet without vowels/similar chars). */
export function rsHash(seed: string): string {
  return pseudoHash(seed, 9, "bcdfghkmnpqrstvwxz2456789");
}

export function podSuffix(seed: string): string {
  return pseudoHash(seed, 5, "bcdfghkmnpqrstvwxz2456789");
}
