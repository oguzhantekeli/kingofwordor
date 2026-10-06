import { describe, expect, it } from 'vitest';
import { Dictionary } from '../dictionary';
import { weightedPick, mulberry32 } from '../rng';
import { createPromptGenerator, pickCategory } from '../rules';
import { tierWeight } from '../scoring';
import { Round, configFor } from '../round';
import { gameData } from './fixture';

const { dict, pools, viability } = gameData();

describe('edge cases', () => {
  /** A format-2 blob by hand (layout: tools/kowd.mjs), so each defect can be planted. */
  function blob(text: string, opts: { count?: number; lang?: string; textLen?: number; tier?: number } = {}) {
    const bytes = new TextEncoder().encode(text);
    const count = opts.count ?? text.split('\n').length;
    const tiersLen = Math.ceil(count / 2);
    const buf = new Uint8Array(32 + tiersLen + bytes.length);
    buf.set([0x4b, 0x4f, 0x57, 0x44]);
    const v = new DataView(buf.buffer);
    v.setUint32(4, 2, true);
    v.setUint32(8, count, true);
    v.setUint32(12, opts.textLen ?? bytes.length, true);
    buf.set(new TextEncoder().encode(opts.lang ?? 'en'), 16);
    buf[24] = 50;
    v.setUint16(26, 1000, true);
    buf.fill(opts.tier ?? 0, 32, 32 + tiersLen);
    buf.set(bytes, 32 + tiersLen);
    return buf.buffer;
  }

  it('a well-formed hand-made blob parses (the baseline the defects below break)', () => {
    const d = Dictionary.parse(blob('aaa\nbbb'));
    expect(d.size).toBe(2);
    expect(d.has('bbb')).toBe(true);
    expect(d.wordAt(0)).toBe('aaa');
  });

  it('rejects a blob whose declared size does not match its bytes', () => {
    expect(() => Dictionary.parse(blob('aaa\nbbb', { textLen: 999 }))).toThrow(/size mismatch/);
  });

  it('rejects a blob whose word count disagrees with its text', () => {
    expect(() => Dictionary.parse(blob('aaa\nbbb', { count: 5 }))).toThrow(/word count mismatch/);
    expect(() => Dictionary.parse(blob('aaa\nbbb\nccc', { count: 2 }))).toThrow(/word count mismatch/);
  });

  it('rejects unsorted or duplicated words - the binary search depends on order', () => {
    expect(() => Dictionary.parse(blob('bbb\naaa'))).toThrow(/out of order/);
    expect(() => Dictionary.parse(blob('aaa\naaa'))).toThrow(/out of order/);
  });

  it('rejects letters outside the declared language and unknown languages', () => {
    expect(() => Dictionary.parse(blob('añb'))).toThrow(/not in the en alphabet/);
    expect(Dictionary.parse(blob('añb', { lang: 'es' })).has('AÑB')).toBe(true);
    expect(() => Dictionary.parse(blob('aaa', { lang: 'de' }))).toThrow(/unsupported language "de"/);
  });

  it('rejects a tier nibble outside TIERS', () => {
    expect(() => Dictionary.parse(blob('aaa', { tier: 0x0f }))).toThrow(/no valid tier/);
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
