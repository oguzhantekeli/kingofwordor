import { describe, expect, it } from 'vitest';
import { mulberry32, randInt, weightedPick } from '../rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = Array.from({ length: 10 }, mulberry32(1));
    const b = Array.from({ length: 10 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('stays in [0,1)', () => {
    const r = mulberry32(999);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays in range', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = randInt(r, 26);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(26);
    }
  });

  it('weightedPick respects weights', () => {
    const r = mulberry32(42);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 20000; i++) {
      counts[weightedPick(r, [['a', 90] as const, ['b', 10] as const])]++;
    }
    expect(counts.a / 20000).toBeGreaterThan(0.87);
    expect(counts.a / 20000).toBeLessThan(0.93);
  });
});
