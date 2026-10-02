/**
 * Deterministic PRNG. The server regenerates the identical prompt sequence from
 * the same seed to re-score a round (plan §7.2), so this must never change
 * behaviour without a format version bump.
 *
 * mulberry32 - 32-bit state, uniform, fast, and trivially portable to any
 * server language.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [0, n). */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Pick by weight. `weights` must be non-empty and sum > 0. */
export function weightedPick<T>(
  rng: () => number,
  entries: readonly (readonly [T, number])[]
): T {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1]![0];
}
