import type { Dictionary } from './dictionary';
import { mulberry32, weightedPick, randInt } from './rng';
import {
  CONDITIONS,
  type Band, type Category, type Condition, type Difficulty, type Prompt,
} from './types';

export { MIN_CATEGORY_WORDS } from './dictionary';

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

/**
 * The thresholds for one dictionary. BAND_MAX was measured on English, whose
 * everyday pool is SCOWL's 61,178 words; a language whose everyday pool is a
 * fifth of that has a fifth of the words behind every prompt, and the same
 * absolute thresholds would push its whole game a band harder. bandScale is
 * that ratio in thousandths, written into the dictionary at build time -
 * exactly 1000 for English, so English bands are BAND_MAX unchanged.
 */
export function bandThresholds(bandScale: number): Readonly<Record<Band, number>> {
  const at = (n: number) => Math.round((n * bandScale) / 1000);
  return {
    impossible: at(BAND_MAX.impossible),
    hard: at(BAND_MAX.hard),
    medium: at(BAND_MAX.medium),
    easy: at(BAND_MAX.easy),
    trivial: Number.POSITIVE_INFINITY,
  };
}

export function bandFor(
  everydayCount: number, max: Readonly<Record<Band, number>> = BAND_MAX
): Band {
  if (everydayCount <= max.impossible) return 'impossible';
  if (everydayCount <= max.hard) return 'hard';
  if (everydayCount <= max.medium) return 'medium';
  if (everydayCount <= max.easy) return 'easy';
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

/**
 * Bucket every (condition, letter) pair by band - 78 in English, 87 with a
 * 29-letter alphabet. Computed once per dictionary, in the alphabet's order.
 */
export function buildPromptPools(dict: Dictionary): PromptPools {
  const byBand: Record<Band, (readonly [Condition, string])[]> = {
    impossible: [], hard: [], medium: [], easy: [], trivial: [],
  };
  const bands = bandThresholds(dict.bandScale);
  for (const condition of CONDITIONS) {
    for (const letter of dict.alphabet) {
      const { everyday } = dict.statsFor(condition, letter);
      byBand[bandFor(everyday, bands)].push([condition, letter] as const);
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
  const bands = bandThresholds(dict.bandScale);
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
      band: bandFor(stats.everyday, bands),
    };
  };
}
