import { describe, expect, it } from 'vitest';
import {
  RANKS, rankFor, xpForRound, dayKey, dailySeed, dailyNumber, daysBetween,
  recordDaily, liveStreak, playedToday, msUntilNextDaily,
} from '../progress';

describe('ranks', () => {
  it('starts at peasant and ends at the game title', () => {
    expect(rankFor(0).id).toBe('peasant');
    expect(RANKS.at(-1)!.id).toBe('king');
    expect(rankFor(10_000_000).id).toBe('king');
    expect(rankFor(10_000_000).progress).toBe(1);
    expect(rankFor(10_000_000).next).toBeNull();
  });
  it('thresholds are strictly increasing', () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.xp).toBeGreaterThan(RANKS[i - 1]!.xp);
  });
  it('reports progress toward the next rank', () => {
    const r = rankFor(800); // footman 400 -> man-at-arms 1200
    expect(r.id).toBe('footman');
    expect(r.progress).toBeCloseTo(0.5, 5);
    expect(r.next).toBe(1200);
  });
  it('crossing a threshold promotes exactly', () => {
    expect(rankFor(399).id).toBe('peasant');
    expect(rankFor(400).id).toBe('footman');
  });
  it('a round always earns XP, the daily earns double', () => {
    expect(xpForRound(0, false)).toBe(10);
    expect(xpForRound(300, false)).toBe(310);
    expect(xpForRound(300, true)).toBe(620);
    expect(xpForRound(-5, false)).toBe(10);
  });
});

describe('daily siege', () => {
  it('dayKey uses the local calendar', () => {
    expect(dayKey(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
    expect(dayKey(new Date(2026, 9, 7, 0, 1))).toBe('2026-10-07');
  });
  it('everyone gets the same seed on the same day, a new one the next day', () => {
    expect(dailySeed('2026-10-06')).toBe(dailySeed('2026-10-06'));
    expect(dailySeed('2026-10-06')).not.toBe(dailySeed('2026-10-07'));
  });
  it('seeds do not collide across two years of days', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 730; i++) {
      const d = new Date(2026, 9, 1 + i);
      seen.add(dailySeed(dayKey(d)));
    }
    expect(seen.size).toBe(730);
  });
  it('numbers sieges from launch day', () => {
    expect(dailyNumber('2026-10-01')).toBe(1);
    expect(dailyNumber('2026-10-06')).toBe(6);
    expect(dailyNumber('2027-10-01')).toBe(366);
  });
  it('daysBetween is exact across month and year ends', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // leap year
  });
});

describe('streaks', () => {
  const empty = { last: null, streak: 0, best: 0 };
  it('first daily starts a streak of 1', () => {
    expect(recordDaily(empty, '2026-10-06')).toEqual({ last: '2026-10-06', streak: 1, best: 1 });
  });
  it('consecutive days extend it', () => {
    let s = recordDaily(empty, '2026-10-06');
    s = recordDaily(s, '2026-10-07');
    s = recordDaily(s, '2026-10-08');
    expect(s.streak).toBe(3);
    expect(s.best).toBe(3);
  });
  it('playing twice in one day changes nothing', () => {
    const s = recordDaily(empty, '2026-10-06');
    expect(recordDaily(s, '2026-10-06')).toBe(s);
  });
  it('a missed day resets to 1 but keeps the best', () => {
    let s = recordDaily(empty, '2026-10-06');
    s = recordDaily(s, '2026-10-07');
    s = recordDaily(s, '2026-10-09');
    expect(s.streak).toBe(1);
    expect(s.best).toBe(2);
  });
  it('the streak survives across a month boundary', () => {
    let s = recordDaily(empty, '2026-10-31');
    s = recordDaily(s, '2026-11-01');
    expect(s.streak).toBe(2);
  });
  it('liveStreak shows a streak only while it can still be kept', () => {
    const s = { last: '2026-10-06', streak: 5, best: 5 };
    expect(liveStreak(s, '2026-10-06')).toBe(5); // played today
    expect(liveStreak(s, '2026-10-07')).toBe(5); // play today to keep it
    expect(liveStreak(s, '2026-10-08')).toBe(0); // lost
    expect(playedToday(s, '2026-10-06')).toBe(true);
    expect(playedToday(s, '2026-10-07')).toBe(false);
  });
  it('time to the next siege is until local midnight', () => {
    expect(msUntilNextDaily(new Date(2026, 9, 6, 23, 0, 0))).toBe(3_600_000);
    expect(msUntilNextDaily(new Date(2026, 9, 6, 0, 0, 0))).toBe(86_400_000);
  });
});
