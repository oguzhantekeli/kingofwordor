/**
 * ENGLISH IS UNCHANGED BY THE MULTI-LANGUAGE ENGINE.
 *
 * golden-en.json was recorded with the format-1 engine (a Map of 110,248
 * strings, prompt statistics computed over decoded words) immediately before
 * the format-2 rewrite. Every number a player or the server can observe is
 * compared: per-prompt statistics, category viability, band membership, the
 * first 25 prompts and running scores for 12 seed/difficulty pairs, tiers and
 * categories. Any drift would change existing dailies and ladder scores.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Round, configFor } from '../round';
import { dailySeed } from '../progress';
import { CONDITIONS, type Difficulty } from '../types';
import { gameData } from './fixture';

const golden = JSON.parse(fs.readFileSync(path.resolve('src/core/__tests__/golden-en.json'), 'utf8'));

describe('golden English behaviour', () => {
  const { dict, pools, viability } = gameData();

  it('dictionary size and rarity baseline', () => {
    expect(dict.size).toBe(golden.size);
    expect(dict.maxEverydayCount()).toBe(golden.maxEveryday);
  });

  it('every prompt statistic and category list', () => {
    for (const c of CONDITIONS) {
      for (const l of 'abcdefghijklmnopqrstuvwxyz') {
        const s = dict.statsFor(c, l);
        expect([s.everyday, s.accepted], `${c}:${l}`).toEqual(golden.stats[`${c}:${l}`]);
        expect([...(viability.get(`${c}:${l}`) ?? [])], `${c}:${l}`).toEqual(golden.viable[`${c}:${l}`]);
      }
    }
  });

  it('band membership, in order', () => {
    const bands = Object.fromEntries(
      Object.entries(pools.byBand).map(([b, p]) => [b, p.map(([c, l]) => `${c}:${l}`)])
    );
    expect(bands).toEqual(golden.bands);
  });

  it('the first 25 prompts and the running score for 12 seeds x difficulties', () => {
    for (const seed of [1, 42, 123456789, dailySeed('2026-10-06')]) {
      for (const d of ['squire', 'knight', 'warlord'] as Difficulty[]) {
        const r = new Round(dict, configFor(d, seed), { pools, viability });
        const seq: string[] = [];
        const pts: number[] = [];
        for (let i = 0; i < 25; i++) {
          const p = r.state.prompt;
          seq.push(`${p.condition}:${p.letter}:${p.category ?? '-'}:${p.everydayCount}:${p.band}`);
          const w = ['able', 'zebra', 'jazz', 'quick', 'sword', 'knight', 'castle', 'dragon', 'fire', 'water']
            .find((x) => r.submit(x, i * 1000).submission.accepted);
          if (!w) r.skip(i * 1000);
          pts.push(r.state.totalScore);
        }
        expect(seq, `${seed}:${d} prompts`).toEqual(golden.prompts[`${seed}:${d}`]);
        expect(pts, `${seed}:${d} scores`).toEqual(golden.scores[`${seed}:${d}`]);
      }
    }
  });

  it('tiers and categories of sample words', () => {
    const tiers = ['sword', 'able', 'zebra', 'quixotic', 'aardvark', 'xylophone']
      .map((w) => `${w}:${dict.tierOf(w)}:${dict.categoriesOf(w).join('|')}`);
    expect(tiers).toEqual(golden.tiers);
  });
});
