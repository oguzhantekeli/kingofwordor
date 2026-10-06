import { describe, expect, it, vi } from 'vitest';

async function rehydrate(state: object, version: number) {
  localStorage.clear();
  localStorage.setItem('kow.session', JSON.stringify({ state, version }));
  vi.resetModules();
  const { useSession } = await import('../store/sessionStore');
  await useSession.persist.rehydrate();
  return useSession.getState();
}

describe('session store migrations', () => {
  it('v1 -> v3: an Oct-2 best (17.32) is rescaled to 173 and becomes the English best', async () => {
    const s = await rehydrate({ status: 'guest', userId: null, name: 'Ramo', house: 'azure', localBest: 17.32 }, 0);
    expect(s.bests).toEqual({ en: 173 });
    expect(Number.isInteger(s.bests.en)).toBe(true);
    expect(s).not.toHaveProperty('localBest');
    expect(s.name).toBe('Ramo');
    expect(s.house).toBe('azure');
    expect(s.xp).toBe(0);
    expect(s.daily).toEqual({ last: null, streak: 0, best: 0 });
    expect(s.dailyScores).toEqual({});
  });

  it('v2 -> v3: the one best and the siege history were English; XP and the streak stay global', async () => {
    const s = await rehydrate({
      status: 'guest', userId: null, name: 'X', house: 'crimson', localBest: 640, xp: 900,
      daily: { last: '2026-10-05', streak: 3, best: 3 },
      dailyScores: { '2026-10-04': 210, '2026-10-05': 330 },
      stats: { rounds: 4, words: 20, bestWord: null },
    }, 2);
    expect(s.bests).toEqual({ en: 640 });
    expect(s.dailyScores).toEqual({ en: { '2026-10-04': 210, '2026-10-05': 330 } });
    expect(s.xp).toBe(900);
    expect(s.daily).toEqual({ last: '2026-10-05', streak: 3, best: 3 });
    expect(s.stats.rounds).toBe(4);
  });

  it('a v2 player with no score yet gets no phantom English best', async () => {
    const s = await rehydrate({ status: 'guest', userId: null, name: 'Y', house: 'forest', localBest: 0, xp: 0,
      daily: { last: null, streak: 0, best: 0 }, dailyScores: {}, stats: { rounds: 0, words: 0, bestWord: null } }, 2);
    expect(s.bests).toEqual({});
    expect(s.dailyScores).toEqual({});
  });

  it('a v3 store is left alone', async () => {
    const s = await rehydrate({ status: 'guest', userId: null, name: 'Z', house: 'violet', bests: { tr: 410, en: 90 }, xp: 50,
      daily: { last: null, streak: 0, best: 0 }, dailyScores: { tr: { '2026-10-07': 410 } },
      stats: { rounds: 2, words: 9, bestWord: null } }, 3);
    expect(s.bests).toEqual({ tr: 410, en: 90 });
    expect(s.dailyScores).toEqual({ tr: { '2026-10-07': 410 } });
  });

  it('records are kept per language: a Turkish round never beats or overwrites the English best', async () => {
    const s0 = await rehydrate({ status: 'guest', userId: null, name: 'W', house: 'crimson', bests: { en: 500 }, xp: 0,
      daily: { last: null, streak: 0, best: 0 }, dailyScores: {}, stats: { rounds: 0, words: 0, bestWord: null } }, 3);
    expect(s0.bests.en).toBe(500);
    const { useSession } = await import('../store/sessionStore');
    const tr = useSession.getState().recordRound({ lang: 'tr', points: 120, words: 3, bestWord: null, daily: true, day: '2026-10-07' });
    expect(tr.newBest).toBe(true); // the first Turkish score is a Turkish record...
    const en = useSession.getState().recordRound({ lang: 'en', points: 300, words: 5, bestWord: null, daily: true, day: '2026-10-07' });
    expect(en.newBest).toBe(false); // ...and 300 is still below the English 500
    const s = useSession.getState();
    expect(s.bests).toEqual({ en: 500, tr: 120 });
    expect(s.dailyScores).toEqual({ tr: { '2026-10-07': 120 }, en: { '2026-10-07': 300 } });
    expect(s.daily.streak).toBe(1); // two sieges on one day are one day of streak
  });
});
