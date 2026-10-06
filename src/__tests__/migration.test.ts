import { describe, expect, it, vi } from 'vitest';

describe('session store migration v1 -> v2', () => {
  it('rescales an Oct-2 best (17.32) to the integer scale (173) and keeps name and house', async () => {
    localStorage.clear();
    localStorage.setItem('kow.session', JSON.stringify({
      state: { status: 'guest', userId: null, name: 'Ramo', house: 'azure', localBest: 17.32 },
      version: 0,
    }));
    vi.resetModules();
    const { useSession } = await import('../store/sessionStore');
    await useSession.persist.rehydrate();
    const s = useSession.getState();
    expect(s.localBest).toBe(173);
    expect(Number.isInteger(s.localBest)).toBe(true);
    expect(s.name).toBe('Ramo');
    expect(s.house).toBe('azure');
    expect(s.xp).toBe(0);
    expect(s.daily).toEqual({ last: null, streak: 0, best: 0 });
  });

  it('a v2 store is left alone', async () => {
    localStorage.clear();
    localStorage.setItem('kow.session', JSON.stringify({
      state: { status: 'guest', userId: null, name: 'X', house: 'crimson', localBest: 640, xp: 900,
               daily: { last: '2026-10-05', streak: 3, best: 3 }, dailyScores: {}, stats: { rounds: 4, words: 20, bestWord: null } },
      version: 2,
    }));
    vi.resetModules();
    const { useSession } = await import('../store/sessionStore');
    await useSession.persist.rehydrate();
    expect(useSession.getState().localBest).toBe(640);
    expect(useSession.getState().xp).toBe(900);
  });
});
