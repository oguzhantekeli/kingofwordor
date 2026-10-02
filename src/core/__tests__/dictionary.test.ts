import { describe, expect, it } from 'vitest';
import { Dictionary, matchesRule } from '../dictionary';
import { gameData } from './fixture';

describe('Dictionary', () => {
  const { dict } = gameData();

  it('loads the shipped dictionary', () => {
    expect(dict.size).toBe(110248);
    expect(dict.maxTier).toBe(70);
  });

  it('REGRESSION (audit §3.2): uppercase input matches identically', () => {
    expect(dict.has('sword')).toBe(true);
    expect(dict.has('Sword')).toBe(true);
    expect(dict.has('SWORD')).toBe(true);
    expect(dict.tierOf('Sword')).toBe(dict.tierOf('sword'));
    expect(matchesRule('Sword', 'startsWith', 's')).toBe(true);
    expect(matchesRule('swordS', 'endsWith', 's')).toBe(true);
    expect(matchesRule('SWORD', 'includes', 'w')).toBe(true);
  });

  it('carries tier metadata', () => {
    expect(dict.tierOf('sword')).toBe(20);
    expect(dict.tierOf('email')).toBe(35);
    expect(dict.tierOf('selfie')).toBe(50);
    expect(dict.tierOf('emoji')).toBe(50);
  });

  it('excludes words above the tier cutoff', () => {
    expect(dict.has('zyzzyva')).toBe(false); // SCOWL tier 80
    expect(dict.has('asdfgh')).toBe(false);
    expect(dict.tierOf('asdfgh')).toBeNull();
  });

  it('carries WordNet categories', () => {
    expect(dict.categoriesOf('knight')).toEqual(expect.arrayContaining(['person', 'object']));
    expect(dict.categoriesOf('dragon')).toEqual(expect.arrayContaining(['animal', 'person']));
    expect(dict.categoriesOf('email')).toContain('communication');
    expect(dict.hasCategory('dragon', 'animal')).toBe(true);
    expect(dict.hasCategory('dragon', 'food')).toBe(false);
    expect(dict.hasCategory('notaword', 'animal')).toBe(false);
  });

  it('computes prompt statistics', () => {
    const e = dict.statsFor('includes', 'e');
    expect(e.everyday).toBeGreaterThan(30000);
    expect(e.accepted).toBeGreaterThan(e.everyday);
    const q = dict.statsFor('endsWith', 'q');
    expect(q.accepted).toBe(0);
    expect(q.everyday).toBe(0);
  });

  it('rejects a malformed blob instead of silently failing every word', () => {
    expect(() => Dictionary.parse(new ArrayBuffer(4))).toThrow(/truncated/);
    const bad = new Uint8Array(32);
    bad.set([0x42, 0x41, 0x44, 0x21]); // "BAD!"
    expect(() => Dictionary.parse(bad.buffer)).toThrow(/bad magic/);
    const wrongVer = new Uint8Array(32);
    wrongVer.set([0x4b, 0x4f, 0x57, 0x44]);
    new DataView(wrongVer.buffer).setUint32(4, 99, true);
    expect(() => Dictionary.parse(wrongVer.buffer)).toThrow(/unsupported format version/);
  });

  it('matchesRule handles every condition', () => {
    expect(matchesRule('apple', 'startsWith', 'a')).toBe(true);
    expect(matchesRule('apple', 'startsWith', 'b')).toBe(false);
    expect(matchesRule('apple', 'endsWith', 'e')).toBe(true);
    expect(matchesRule('apple', 'endsWith', 'a')).toBe(false);
    expect(matchesRule('apple', 'includes', 'pp')).toBe(true);
    expect(matchesRule('apple', 'includes', 'z')).toBe(false);
  });
});
