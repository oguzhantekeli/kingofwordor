import { describe, expect, it } from 'vitest';
import { bandFor, createPromptGenerator, DIFFICULTY_WEIGHTS, MIN_CATEGORY_WORDS } from '../rules';
import { CONDITIONS, type Difficulty } from '../types';
import { gameData } from './fixture';

describe('rules / prompt generation', () => {
  const { dict, pools, viability } = gameData();

  it('bands the 78 prompts', () => {
    const total = Object.values(pools.byBand).reduce((n, p) => n + p.length, 0);
    expect(total).toBe(CONDITIONS.length * 26);
    expect(total).toBe(78);
  });

  it('identifies the unwinnable prompts the old app generated freely', () => {
    const impossible = pools.byBand.impossible.map(([c, l]) => `${c}:${l}`).sort();
    expect(impossible).toContain('endsWith:q'); //   0 accepted words
    expect(impossible).toContain('endsWith:j'); //   4 accepted words
    expect(impossible).toContain('endsWith:v');
    expect(impossible).toContain('startsWith:x');
    expect(dict.statsFor('endsWith', 'q').accepted).toBe(0);
  });

  it('bandFor maps counts to bands', () => {
    expect(bandFor(0)).toBe('impossible');
    expect(bandFor(25)).toBe('impossible');
    expect(bandFor(26)).toBe('hard');
    expect(bandFor(150)).toBe('hard');
    expect(bandFor(151)).toBe('medium');
    expect(bandFor(800)).toBe('medium');
    expect(bandFor(801)).toBe('easy');
    expect(bandFor(4000)).toBe('easy');
    expect(bandFor(4001)).toBe('trivial');
  });

  const difficulties: Difficulty[] = ['squire', 'knight', 'warlord'];

  it.each(difficulties)(
    'ACCEPTANCE: %s never generates an impossible prompt in 100,000 draws',
    (difficulty) => {
      const next = createPromptGenerator({ dict, pools, viability, difficulty, seed: 20261001 });
      for (let i = 0; i < 100_000; i++) {
        const p = next();
        expect(p.band).not.toBe('impossible');
        expect(p.everydayCount).toBeGreaterThan(25);
      }
    }
  );

  it.each(difficulties)('%s only draws from its configured bands', (difficulty) => {
    const allowed = new Set(DIFFICULTY_WEIGHTS[difficulty].map(([b]) => b));
    const next = createPromptGenerator({ dict, pools, viability, difficulty, seed: 5 });
    for (let i = 0; i < 20_000; i++) expect(allowed.has(next().band)).toBe(true);
  });

  it('is deterministic: same seed produces the same sequence', () => {
    const mk = () => createPromptGenerator({ dict, pools, viability, difficulty: 'knight', seed: 777 });
    const a = Array.from({ length: 200 }, mk());
    const b = Array.from({ length: 200 }, mk());
    expect(a).toEqual(b);
  });

  it('different seeds produce different sequences', () => {
    const a = Array.from({ length: 50 }, createPromptGenerator({ dict, pools, viability, difficulty: 'knight', seed: 1 }));
    const b = Array.from({ length: 50 }, createPromptGenerator({ dict, pools, viability, difficulty: 'knight', seed: 2 }));
    expect(a).not.toEqual(b);
  });

  it('every suggested category is actually satisfiable', () => {
    const next = createPromptGenerator({ dict, pools, viability, difficulty: 'warlord', seed: 31337 });
    for (let i = 0; i < 2000; i++) {
      const p = next();
      if (p.category === null) continue;
      const viable = viability.get(`${p.condition}:${p.letter}`) ?? [];
      expect(viable).toContain(p.category);
    }
  });

  it('category viability threshold is enforced', () => {
    // audit §6: 72 of 78 prompts support at least one category
    let withCategory = 0;
    for (const c of CONDITIONS) {
      for (const l of 'abcdefghijklmnopqrstuvwxyz') {
        if ((viability.get(`${c}:${l}`) ?? []).length > 0) withCategory++;
      }
    }
    expect(withCategory).toBe(72);
    expect(MIN_CATEGORY_WORDS).toBe(8);
  });
});
