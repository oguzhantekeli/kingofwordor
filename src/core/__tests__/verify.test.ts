import { describe, expect, it } from 'vitest';
import { verifyRound, MIN_ACCEPT_GAP_MS, type RoundEvent, type RoundSubmission } from '../verify';
import { Round, configFor } from '../round';
import { dailySeed } from '../progress';
import { matchesRule } from '../dictionary';
import { gameData } from './fixture';

const data = gameData();
const { dict, pools, viability } = data;
const deps = { dict, pools, viability, now: new Date(2026, 9, 6, 12), today: '2026-10-06' };

/** Play an honest round the way the client does, recording its event log. */
function honest(seed: number, difficulty: 'squire' | 'knight' | 'warlord' = 'knight', gap = 2000) {
  const r = new Round(dict, configFor(difficulty, seed), { pools, viability });
  const events: RoundEvent[] = [];
  let at = 1500;
  for (let i = 0; i < 10; i++) {
    const p = r.state.prompt;
    if (i === 4) { r.skip(at); events.push({ word: '', at, skip: true }); at += gap; continue; }
    const w = data.words.find((c) => c.length >= r.config.minWordLength && c.length <= 8
      && !r.playedWords.has(c) && (dict.tierOf(c) ?? 99) <= r.config.maxTier
      && matchesRule(c, p.condition, p.letter))!;
    r.submit(w, at);
    events.push({ word: w, at });
    at += gap;
  }
  // end on a miss, so honest logs include a rejected word too
  r.submit('zzzzq', at);
  events.push({ word: 'zzzzq', at });
  return { events, score: r.state.totalScore };
}

const sub = (o: Partial<RoundSubmission> & { events: RoundEvent[] }): RoundSubmission => ({
  mode: 'solo', day: '', seed: 777, difficulty: 'knight', claimedScore: 0, ...o,
});

describe('server-side verification', () => {
  it('accepts an honest round and reproduces its score exactly', () => {
    const { events, score } = honest(777);
    const v = verifyRound(sub({ events, claimedScore: score }), deps);
    expect(v.ok).toBe(true);
    expect(v.score).toBe(score);
    expect(v.mismatch).toBe(false);
    expect(v.words).toBe(9);
  });

  it('ANTI-CHEAT: a forged score is replaced by the replay, and flagged', () => {
    const { events, score } = honest(777);
    const v = verifyRound(sub({ events, claimedScore: 999_999 }), deps);
    expect(v.ok).toBe(true);
    expect(v.score).toBe(score);          // the server's number, not the client's
    expect(v.score).not.toBe(999_999);
    expect(v.mismatch).toBe(true);
    expect(v.reasons.join()).toMatch(/claimed 999999/);
  });

  it('ANTI-CHEAT: inventing words the dictionary rejects scores nothing', () => {
    const events = [{ word: 'qzxqzx', at: 1000 }, { word: 'xxqqzz', at: 3000 }];
    const v = verifyRound(sub({ events, claimedScore: 5000 }), deps);
    expect(v.score).toBe(0);
    expect(v.mismatch).toBe(true);
  });

  it('ANTI-CHEAT: replaying the same valid word repeatedly earns it once', () => {
    const { events } = honest(777);
    const first = events.find((e) => !e.skip)!;
    const spam = Array.from({ length: 20 }, (_, i) => ({ word: first.word, at: 1500 + i * 1000 }));
    const once = verifyRound(sub({ events: [spam[0]!] }), deps).score;
    expect(verifyRound(sub({ events: spam }), deps).score).toBe(once);
  });

  it('ANTI-CHEAT: bot-speed submissions are rejected', () => {
    const { events } = honest(777, 'knight', MIN_ACCEPT_GAP_MS - 50);
    const v = verifyRound(sub({ events }), deps);
    expect(v.ok).toBe(false);
    expect(v.reasons.join()).toMatch(/ms apart/);
  });

  it('ANTI-CHEAT: events after the round ended are rejected', () => {
    const { events } = honest(777);
    const late = [...events, { word: 'zzzz', at: 120_000 }];
    expect(verifyRound(sub({ events: late }), deps).ok).toBe(false);
  });

  it('skips shorten the allowed window by three seconds each', () => {
    // knight = 60 s. Two skips -> 54 s (+1.5 s slack). An event at 57 s is too late.
    const events = [
      { word: '', at: 1000, skip: true },
      { word: '', at: 2000, skip: true },
      { word: 'zzzz', at: 57_000 },
    ];
    expect(verifyRound(sub({ events }), deps).ok).toBe(false);
    events[2]!.at = 55_000;
    expect(verifyRound(sub({ events }), deps).ok).toBe(true);
  });

  it('rejects timestamps that go backwards', () => {
    const events = [{ word: 'zzzz', at: 5000 }, { word: 'qqqq', at: 4000 }];
    expect(verifyRound(sub({ events }), deps).ok).toBe(false);
  });

  it('rejects absurd payloads', () => {
    expect(verifyRound(sub({ events: Array.from({ length: 401 }, (_, i) => ({ word: 'a', at: i })) }), deps).ok).toBe(false);
    expect(verifyRound(sub({ events: [], difficulty: 'god' as never }), deps).ok).toBe(false);
    expect(verifyRound(sub({ events: [], seed: -1 }), deps).ok).toBe(false);
    expect(verifyRound(sub({ events: [{ word: 'x'.repeat(40), at: 1 }] }), deps).ok).toBe(false);
    expect(verifyRound(sub({ events: [{ word: 'ok', at: Number.NaN }] }), deps).ok).toBe(false);
  });

  describe('daily siege', () => {
    it('accepts the real daily for today', () => {
      const seed = dailySeed('2026-10-06');
      const { events, score } = honest(seed);
      const v = verifyRound(sub({ mode: 'daily', day: '2026-10-06', seed, events, claimedScore: score }), deps);
      expect(v.ok).toBe(true);
      expect(v.score).toBe(score);
    });
    it('ANTI-CHEAT: a daily played on a hand-picked easy seed is rejected', () => {
      const { events } = honest(12345);
      const v = verifyRound(sub({ mode: 'daily', day: '2026-10-06', seed: 12345, events }), deps);
      expect(v.ok).toBe(false);
      expect(v.reasons.join()).toMatch(/seed does not match/);
    });
    it('ANTI-CHEAT: a daily at an easier difficulty is rejected', () => {
      const seed = dailySeed('2026-10-06');
      expect(verifyRound(sub({ mode: 'daily', day: '2026-10-06', seed, difficulty: 'squire', events: [] }), deps).ok).toBe(false);
    });
    it('tolerates one day either side for time zones, rejects stale sieges', () => {
      for (const [day, ok] of [['2026-10-05', true], ['2026-10-07', true], ['2026-10-03', false]] as const) {
        const v = verifyRound(sub({ mode: 'daily', day, seed: dailySeed(day), events: [] }), deps);
        expect(v.ok, day).toBe(ok);
      }
    });
  });
});
