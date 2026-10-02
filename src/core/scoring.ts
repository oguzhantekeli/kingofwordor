import { TIERS, type Prompt, type Tier } from './types';

/**
 * Scoring formula (audit §5.5, locked):
 *   word_score = base(length) x rarity(prompt) x tier(word) x category_bonus
 * Volume is not a separate term - it emerges from summing across the round.
 *
 * There is deliberately NO platform/input-method factor: device detection is a
 * spoofable user-agent string, a Bluetooth keyboard on a tablet defeats the
 * classification, and penalising hardware reads as punishment.
 */

export const CATEGORY_BONUS = 1.5;
export const RARITY_MIN = 1.0;
export const RARITY_MAX = 4.0;

/** Tier weight, interpolated across the SCOWL tiers from common to rare. */
export const TIER_WEIGHT_MIN = 1.0;
export const TIER_WEIGHT_MAX = 1.6;

export function baseScore(wordLength: number): number {
  return wordLength;
}

/**
 * Rarer prompts pay more. Scaled against the richest prompt in the dictionary
 * so the curve adapts automatically to a different language's letter
 * distribution - "ends with q" is not hard in every language.
 */
export function rarityWeight(everydayCount: number, maxEverydayCount: number): number {
  if (everydayCount <= 0) return RARITY_MAX;
  const ratio = Math.max(1, maxEverydayCount) / everydayCount;
  const raw = Math.log10(ratio) + 1;
  return clamp(raw, RARITY_MIN, RARITY_MAX);
}

export function tierWeight(tier: Tier): number {
  const i = TIERS.indexOf(tier);
  if (i < 0) return TIER_WEIGHT_MIN;
  const span = TIERS.length - 1;
  return TIER_WEIGHT_MIN + ((TIER_WEIGHT_MAX - TIER_WEIGHT_MIN) * i) / span;
}

export interface ScoreInput {
  word: string;
  tier: Tier;
  prompt: Prompt;
  maxEverydayCount: number;
  matchedCategory: boolean;
}

export function scoreWord(input: ScoreInput): number {
  const { word, tier, prompt, maxEverydayCount, matchedCategory } = input;
  const score =
    baseScore(word.length) *
    rarityWeight(prompt.everydayCount, maxEverydayCount) *
    tierWeight(tier) *
    (matchedCategory ? CATEGORY_BONUS : 1);
  return round2(score);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
