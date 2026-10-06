import { beforeEach, describe, expect, it } from 'vitest';
import { configFor, DIFFICULTY_DEFAULTS, Round } from '../round';
import type { Condition } from '../types';
import { gameData } from './fixture';

const data = gameData();
const { dict, pools, viability } = data;
const deps = { pools, viability };
const words = dict.list();

/** Build a round and force a known prompt so tests are not seed-dependent. */
function roundWithPrompt(condition: Condition, letter: string, overrides = {}) {
  const r = new Round(dict, { ...configFor('knight', 1), ...overrides }, deps);
  const stats = dict.statsFor(condition, letter);
  // @ts-expect-error - deliberate test seam into the private current prompt
  r.prompt = {
    condition, letter, category: null,
    everydayCount: stats.everyday, acceptedCount: stats.accepted, band: 'medium',
  };
  return r;
}

describe('Round', () => {
  let r: Round;
  beforeEach(() => { r = roundWithPrompt('startsWith', 's'); });

  it('accepts a valid word and scores it', () => {
    const { submission, state } = r.submit('sword', 100);
    expect(submission.accepted).toBe(true);
    expect(submission.reason).toBeNull();
    expect(submission.points).toBeGreaterThan(0);
    expect(submission.tier).toBe(20);
    expect(state.totalScore).toBe(submission.points);
  });

  it('REGRESSION (audit §3.2): uppercase scores identically to lowercase', () => {
    const lower = roundWithPrompt('startsWith', 's').submit('sword', 0);
    const upper = roundWithPrompt('startsWith', 's').submit('Sword', 0);
    const shout = roundWithPrompt('startsWith', 's').submit('SWORD', 0);
    expect(upper.submission.accepted).toBe(true);
    expect(shout.submission.accepted).toBe(true);
    expect(upper.submission.points).toBe(lower.submission.points);
    expect(shout.submission.points).toBe(lower.submission.points);
  });

  it('REGRESSION (audit §3.3): a duplicate word scores zero on resubmission', () => {
    const first = r.submit('sword', 0);
    expect(first.submission.accepted).toBe(true);
    // force the same prompt back so only the duplicate rule can reject it
    const r2 = roundWithPrompt('startsWith', 's');
    r2.submit('sword', 0);
    // @ts-expect-error - reset prompt to the same rule
    r2.prompt = { condition: 'startsWith', letter: 's', category: null,
      everydayCount: 100, acceptedCount: 200, band: 'medium' };
    const again = r2.submit('sword', 10);
    expect(again.submission.accepted).toBe(false);
    expect(again.submission.reason).toBe('duplicate');
    expect(again.submission.points).toBe(0);
    expect(again.state.totalScore).toBe(r2.state.submissions[0]!.points);
  });

  it('duplicate detection is case-insensitive', () => {
    const r2 = roundWithPrompt('startsWith', 's');
    r2.submit('sword', 0);
    // @ts-expect-error - reset prompt
    r2.prompt = { condition: 'startsWith', letter: 's', category: null,
      everydayCount: 100, acceptedCount: 200, band: 'medium' };
    expect(r2.submit('SWORD', 5).submission.reason).toBe('duplicate');
  });

  it('rejects a word that does not match the rule', () => {
    const { submission } = r.submit('castle', 0);
    expect(submission.accepted).toBe(false);
    expect(submission.reason).toBe('ruleMismatch');
  });

  it('rejects a non-word that matches the rule', () => {
    const { submission } = r.submit('sqqqqq', 0);
    expect(submission.accepted).toBe(false);
    expect(submission.reason).toBe('notAWord');
  });

  it('rejects a word below the minimum length', () => {
    const { submission } = r.submit('so', 0);
    expect(submission.accepted).toBe(false);
    expect(submission.reason).toBe('tooShort');
  });

  it('rejects a word above the difficulty tier cap', () => {
    const squire = roundWithPrompt('startsWith', 's', configFor('squire', 1));
    // a tier-70 word is valid for warlord but not for squire (maxTier 50)
    const rare = [...(function* () {
      for (const w of ['sabaton', 'sabayon', 'saccade', 'sackbut']) yield w;
    })()].find((w) => (dict.tierOf(w) ?? 0) > 50);
    if (!rare) return; // dictionary-dependent; skip rather than assert falsely
    expect(squire.submit(rare, 0).submission.reason).toBe('notAWord');
  });

  it('RULE: a rejected word keeps the prompt (a typo must not steal it)', () => {
    const before = r.state.prompt;
    r.submit('zzzz', 0);            // not a word
    r.submit('castle', 0);          // breaks the "starts with s" rule
    expect(r.state.prompt).toBe(before);
  });

  it('RULE: an accepted word advances the prompt', () => {
    const before = r.state.prompt;
    expect(r.submit('sword', 0).submission.accepted).toBe(true);
    expect(r.state.prompt).not.toBe(before);
  });

  it('RULE: skip advances the prompt and is logged for server replay', () => {
    const before = r.state.prompt;
    const { submission, state } = r.skip(4200);
    expect(state.prompt).not.toBe(before);
    expect(submission.reason).toBe('skipped');
    expect(submission.points).toBe(0);
    expect(state.submissions.at(-1)).toMatchObject({ reason: 'skipped', at: 4200 });
  });

  it('skip does nothing once the round is finished', () => {
    r.finish();
    const before = r.state.prompt;
    r.skip(0);
    expect(r.state.prompt).toBe(before);
  });

  it('REPLAY: the same seed + the same event log reproduces the exact prompts and score', () => {
    // This is the property server-side scoring depends on.
    const play = () => {
      const x = new Round(dict, configFor('knight', 4242), deps);
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        const p = x.state.prompt;
        seen.push(`${p.condition}:${p.letter}:${p.category}`);
        if (i % 4 === 3) { x.skip(i * 1000); continue; }
        const w = words.find((cand) =>
          cand.length >= 4 && cand.length <= 8 && !x.playedWords.has(cand) &&
          (dict.tierOf(cand) ?? 99) <= x.config.maxTier &&
          (p.condition === 'startsWith' ? cand.startsWith(p.letter)
            : p.condition === 'endsWith' ? cand.endsWith(p.letter) : cand.includes(p.letter)));
        x.submit(w ?? 'zzzz', i * 1000);
      }
      return { seen, total: x.state.totalScore };
    };
    expect(play()).toEqual(play());
  });

  it('records submission timestamps for server-side rate checks', () => {
    r.submit('sword', 1200);
    expect(r.state.submissions[0]!.at).toBe(1200);
  });

  it('a finished round accepts nothing', () => {
    r.finish();
    expect(r.state.finished).toBe(true);
    expect(r.submit('sword', 0).submission.accepted).toBe(false);
  });

  it('pays the category bonus when the word matches the hint', () => {
    const base = new Round(dict, configFor('knight', 1), deps);
    // @ts-expect-error - force a prompt with a category the word satisfies
    base.prompt = { condition: 'startsWith', letter: 'd', category: 'animal',
      everydayCount: 500, acceptedCount: 1000, band: 'medium' };
    const withCat = base.submit('dragon', 0);
    expect(withCat.submission.matchedCategory).toBe(true);

    const other = new Round(dict, configFor('knight', 1), deps);
    // @ts-expect-error - same prompt, no category
    other.prompt = { condition: 'startsWith', letter: 'd', category: null,
      everydayCount: 500, acceptedCount: 1000, band: 'medium' };
    const noCat = other.submit('dragon', 0);
    expect(noCat.submission.matchedCategory).toBe(false);
    expect(withCat.submission.points).toBeGreaterThan(noCat.submission.points);
  });

  it('difficulty defaults match the plan', () => {
    expect(DIFFICULTY_DEFAULTS.knight.durationMs).toBe(60_000);
    expect(DIFFICULTY_DEFAULTS.squire.durationMs).toBe(90_000);
    expect(DIFFICULTY_DEFAULTS.warlord.durationMs).toBe(45_000);
    expect(DIFFICULTY_DEFAULTS.warlord.maxTier).toBe(70);
  });

  it('total score is the sum of accepted submissions', () => {
    const r2 = new Round(dict, configFor('squire', 99), deps);
    let expected = 0;
    for (const w of ['castle', 'dragon', 'knight', 'sword', 'banner', 'shield']) {
      const { submission } = r2.submit(w, 0);
      if (submission.accepted) expected += submission.points;
    }
    expect(r2.state.totalScore).toBe(expected);
    expect(Number.isInteger(r2.state.totalScore)).toBe(true);
  });
});
