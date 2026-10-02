import { describe, expect, it } from 'vitest';
import { Dictionary } from '../dictionary';
import { weightedPick, mulberry32 } from '../rng';
import { createPromptGenerator, pickCategory } from '../rules';
import { tierWeight } from '../scoring';
import { Round, configFor } from '../round';
import { gameData } from './fixture';

const { dict, pools, viability } = gameData();

describe('edge cases', () => {
  it('rejects a blob whose declared size does not match its bytes', () => {
    const bad = new Uint8Array(40);
    bad.set([0x4b, 0x4f, 0x57, 0x44]);
    const v = new DataView(bad.buffer);
    v.setUint32(4, 1, true);
    v.setUint32(8, 2, true);      // 2 words
    v.setUint32(12, 999, true);   // but claims 999 bytes of text
    expect(() => Dictionary.parse(bad.buffer)).toThrow(/size mismatch/);
  });

  it('rejects a blob whose word count disagrees with its text', () => {
    const words = 'aaa\nbbb';
    const text = new TextEncoder().encode(words);
    const count = 5; // lie: text holds 2
    const tiersLen = Math.ceil(count / 2);
    const total = 16 + tiersLen + count * 2 + text.length;
    const buf = new Uint8Array(total);
    buf.set([0x4b, 0x4f, 0x57, 0x44]);
    const v = new DataView(buf.buffer);
    v.setUint32(4, 1, true);
    v.setUint32(8, count, true);
    v.setUint32(12, text.length, true);
    buf.set(text, 16 + tiersLen + count * 2);
    expect(() => Dictionary.parse(buf.buffer)).toThrow(/word count mismatch/);
  });

  it('unknown words return null/empty rather than throwing', () => {
    expect(dict.tierOf('qqqqqqq')).toBeNull();
    expect(dict.categoriesOf('qqqqqqq')).toEqual([]);
    expect(dict.statsFor('startsWith', '1')).toEqual({ everyday: 0, accepted: 0 });
  });

  it('weightedPick falls through to the last entry on rounding edges', () => {
    const always1 = () => 0.999999999;
    expect(weightedPick(always1, [['a', 1] as const, ['b', 1] as const])).toBe('b');
  });

  it('tierWeight tolerates an out-of-range tier', () => {
    // @ts-expect-error - deliberately invalid tier
    expect(tierWeight(999)).toBe(1.0);
  });

  it('pickCategory returns null when no category is viable', () => {
    const rng = mulberry32(1);
    expect(pickCategory(dict, 'endsWith', 'q', rng, new Map())).toBeNull();
  });

  it('a generator with no usable band throws rather than looping forever', () => {
    const emptyPools = {
      byBand: { impossible: [], hard: [], medium: [], easy: [], trivial: [] },
    };
    expect(() =>
      createPromptGenerator({
        dict, pools: emptyPools, viability, difficulty: 'knight', seed: 1,
      })
    ).toThrow(/no non-empty prompt band/);
  });

  it('an empty submission is rejected as too short', () => {
    const r = new Round(dict, configFor('knight', 1), { pools, viability });
    expect(r.submit('   ', 0).submission.reason).toBe('tooShort');
  });

  it('playedWords tracks accepted words only', () => {
    const r = new Round(dict, configFor('squire', 3), { pools, viability });
    r.submit('zzzzzz', 0);
    expect(r.playedWords.has('zzzzzz')).toBe(false);
  });
});
