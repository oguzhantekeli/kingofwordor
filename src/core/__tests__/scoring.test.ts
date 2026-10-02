import { describe, expect, it } from 'vitest';
import {
  baseScore, CATEGORY_BONUS, rarityWeight, RARITY_MAX, RARITY_MIN,
  round2, scoreWord, TIER_WEIGHT_MAX, TIER_WEIGHT_MIN, tierWeight,
} from '../scoring';
import { TIERS, type Prompt } from '../types';

const prompt = (everydayCount: number): Prompt => ({
  condition: 'startsWith', letter: 's', category: 'animal',
  everydayCount, acceptedCount: everydayCount * 2, band: 'medium',
});

describe('scoring', () => {
  it('base score is word length', () => {
    expect(baseScore(5)).toBe(5);
    expect(baseScore(12)).toBe(12);
  });

  it('rarity is inversely related to prompt richness', () => {
    const max = 41797;
    expect(rarityWeight(max, max)).toBe(RARITY_MIN);
    expect(rarityWeight(100, max)).toBeGreaterThan(rarityWeight(10000, max));
    expect(rarityWeight(1, max)).toBeLessThanOrEqual(RARITY_MAX);
    expect(rarityWeight(0, max)).toBe(RARITY_MAX);
  });

  it('rarity is clamped', () => {
    for (const n of [1, 5, 50, 500, 5000, 50000]) {
      const w = rarityWeight(n, 41797);
      expect(w).toBeGreaterThanOrEqual(RARITY_MIN);
      expect(w).toBeLessThanOrEqual(RARITY_MAX);
    }
  });

  it('tier weight increases monotonically with rarity', () => {
    const weights = TIERS.map(tierWeight);
    expect(weights[0]).toBe(TIER_WEIGHT_MIN);
    expect(weights[weights.length - 1]).toBe(TIER_WEIGHT_MAX);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeGreaterThan(weights[i - 1]!);
    }
  });

  it('category match pays the bonus', () => {
    const args = { word: 'dragon', tier: 20 as const, prompt: prompt(500), maxEverydayCount: 41797 };
    const plain = scoreWord({ ...args, matchedCategory: false });
    const bonus = scoreWord({ ...args, matchedCategory: true });
    expect(bonus).toBeCloseTo(round2(plain * CATEGORY_BONUS), 1);
  });

  it('a rarer prompt pays more for the same word', () => {
    const args = { word: 'zebra', tier: 20 as const, maxEverydayCount: 41797, matchedCategory: false };
    const rich = scoreWord({ ...args, prompt: prompt(30000) });
    const rare = scoreWord({ ...args, prompt: prompt(50) });
    expect(rare).toBeGreaterThan(rich);
  });

  it('a longer word pays more', () => {
    const args = { tier: 20 as const, prompt: prompt(500), maxEverydayCount: 41797, matchedCategory: false };
    expect(scoreWord({ ...args, word: 'castles' })).toBeGreaterThan(
      scoreWord({ ...args, word: 'cast' })
    );
  });

  it('a rarer word pays more', () => {
    const args = { word: 'sword', prompt: prompt(500), maxEverydayCount: 41797, matchedCategory: false };
    expect(scoreWord({ ...args, tier: 70 })).toBeGreaterThan(scoreWord({ ...args, tier: 10 }));
  });

  it('rounds to 2dp', () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
    // IEEE 754: 1.005 is stored as 1.00499999999999989342..., so it rounds
    // DOWN. Documented rather than "fixed" - scores are display values and a
    // half-cent either way is not worth an exact-decimal dependency.
    expect(round2(1.005)).toBe(1);
  });
});
