import type { Dictionary } from './dictionary';
import { mulberry32, weightedPick, randInt } from './rng';
import {
  CATEGORIES, CONDITIONS,
  type Band, type Category, type Condition, type Difficulty, type Prompt,
} from './types';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Band thresholds by everyday-word count (audit §5, measured against SCOWL).
 * `impossible` prompts are never generated: "ends with q" has 0 accepted words
 * and "ends with j" has 4 - the old app drew both with equal probability.
 */
export const BAND_MAX: Readonly<Record<Band, number>> = {
  impossible: 25,
  hard: 150,
  medium: 800,
  easy: 4000,
  trivial: Number.POSITIVE_INFINITY,
};

/** A category hint must have at least this many everyday words behind it. */
export const MIN_CATEGORY_WORDS = 8;

export function bandFor(everydayCount: number): Band {
  if (everydayCount <= BAND_MAX.impossible) return 'impossible';
  if (everydayCount <= BAND_MAX.hard) return 'hard';
  if (everydayCount <= BAND_MAX.medium) return 'medium';
  if (everydayCount <= BAND_MAX.easy) return 'easy';
  return 'trivial';
}

/** Band mix per difficulty tier. Weights need not sum to 1. */
export const DIFFICULTY_WEIGHTS: Readonly<
  Record<Difficulty, readonly (readonly [Band, number])[]>
> = {
  squire: [['trivial', 70], ['easy', 30]],
  knight: [['easy', 45], ['medium', 35], ['trivial', 20]],
  warlord: [['medium', 50], ['hard', 35], ['easy', 15]],
};

export interface PromptPools {
  byBand: Readonly<Record<Band, readonly (readonly [Condition, string])[]>>;
}

/** Bucket all 78 (condition, letter) pairs by band. Computed once per dictionary. */
export function buildPromptPools(dict: Dictionary): PromptPools {
  const byBand: Record<Band, (readonly [Condition, string])[]> = {
    impossible: [], hard: [], medium: [], easy: [], trivial: [],
  };
  for (const condition of CONDITIONS) {
    for (const letter of ALPHABET) {
      const { everyday } = dict.statsFor(condition, letter);
      byBand[bandFor(everyday)].push([condition, letter] as const);
    }
  }
  return { byBand };
}

/**
 * Pick the category hint for a prompt: only categories that actually have
 * MIN_CATEGORY_WORDS everyday words satisfying the rule. Returns null when the
 * prompt supports none, in which case the UI shows the bare letter rule.
 */
export function pickCategory(
  dict: Dictionary,
  condition: Condition,
  letter: string,
  rng: () => number,
  viableCounts: ReadonlyMap<string, readonly Category[]>
): Category | null {
  const viable = viableCounts.get(`${condition}:${letter}`) ?? [];
  if (viable.length === 0) return null;
  void dict;
  return viable[randInt(rng, viable.length)] ?? null;
}

/**
 * Precompute which categories are viable per prompt. O(dictionary) once, not
 * per round - the alternative is scanning 110k words every time a prompt changes.
 */
export function buildCategoryViability(
  dict: Dictionary, words: Iterable<string>
): Map<string, Category[]> {
  const counts = new Map<string, Int32Array>();
  const keyOf = (c: Condition, l: string) => `${c}:${l}`;
  for (const c of CONDITIONS) {
    for (const l of ALPHABET) counts.set(keyOf(c, l), new Int32Array(CATEGORIES.length));
  }
  const seen = new Set<string>();
  for (const w of words) {
    const tier = dict.tierOf(w);
    if (tier === null || tier > 50) continue; // everyday pool only
    const cats = dict.categoriesOf(w);
    if (cats.length === 0) continue;
    const bits = cats.map((c) => CATEGORIES.indexOf(c));
    const add = (c: Condition, l: string) => {
      const arr = counts.get(keyOf(c, l));
      if (!arr) return;
      for (const b of bits) arr[b]! += 1;
    };
    add('startsWith', w[0]!);
    add('endsWith', w[w.length - 1]!);
    seen.clear();
    for (const ch of w) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      add('includes', ch);
    }
  }
  const viable = new Map<string, Category[]>();
  for (const [k, arr] of counts) {
    viable.set(k, CATEGORIES.filter((_, b) => (arr[b] ?? 0) >= MIN_CATEGORY_WORDS));
  }
  return viable;
}

export interface PromptGeneratorOptions {
  dict: Dictionary;
  pools: PromptPools;
  viability: ReadonlyMap<string, readonly Category[]>;
  difficulty: Difficulty;
  seed: number;
}

/**
 * Deterministic prompt sequence. Given the same seed the server produces the
 * identical list, which is what makes server-side re-scoring possible.
 */
export function createPromptGenerator(opts: PromptGeneratorOptions): () => Prompt {
  const { dict, pools, viability, difficulty, seed } = opts;
  const rng = mulberry32(seed);
  const weights = DIFFICULTY_WEIGHTS[difficulty].filter(
    ([band]) => pools.byBand[band].length > 0
  );
  if (weights.length === 0) {
    throw new Error(`no non-empty prompt band for difficulty "${difficulty}"`);
  }
  return function next(): Prompt {
    const band = weightedPick(rng, weights);
    const pool = pools.byBand[band];
    const picked = pool[randInt(rng, pool.length)]!;
    const [condition, letter] = picked;
    const stats = dict.statsFor(condition, letter);
    return {
      condition,
      letter,
      category: pickCategory(dict, condition, letter, rng, viability),
      everydayCount: stats.everyday,
      acceptedCount: stats.accepted,
      band: bandFor(stats.everyday),
    };
  };
}
