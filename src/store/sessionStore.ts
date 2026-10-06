import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { House } from '../ui/sprites.generated';
import { rankFor, recordDaily, xpForRound, type RankId, type StreakState } from '../core/progress';
import type { Lang } from '../core/lang';

export type SessionStatus = 'guest' | 'signed-in';

/**
 * Identity, guest-first, plus everything that makes a player come back:
 * rank (XP), the daily-siege streak, and personal records.
 *
 * Nobody is asked to sign in to play. A guest gets a local profile and the full
 * solo game including the daily siege; signing in is what posts a score to a
 * ladder and carries progress to another phone.
 */
export interface RoundRecord {
  /** The dictionary it was played in: records are kept per language. */
  lang: Lang;
  points: number;
  words: number;
  bestWord: { word: string; points: number } | null;
  daily: boolean;
  /** dayKey of the round, used when daily is true. */
  day: string;
}

export interface RoundOutcome {
  xpGained: number;
  rankBefore: RankId;
  rankAfter: RankId;
  promoted: boolean;
  newBest: boolean;
  /** Daily streak after this round (0 when the round was not a daily). */
  streak: number;
}

interface SessionState {
  status: SessionStatus;
  userId: string | null;
  name: string;
  house: House;
  /**
   * Best score per language on this device, so a guest still has a record.
   * Per language because a Danish and an English score come from different
   * dictionaries: one best across both would make one of them meaningless.
   */
  bests: Partial<Record<Lang, number>>;
  /** Rank is the player's, not the dictionary's: XP counts in every language. */
  xp: number;
  /** The siege streak: a day counts when any language's siege was played. */
  daily: StreakState;
  /** Per language, dayKey -> points for the last ~60 sieges. One siege per language per day. */
  dailyScores: Partial<Record<Lang, Record<string, number>>>;
  stats: { rounds: number; words: number; bestWord: { word: string; points: number } | null };

  setName: (name: string) => void;
  setHouse: (house: House) => void;
  /** Record a finished round exactly once. Returns what changed, for the results screen. */
  recordRound: (r: RoundRecord) => RoundOutcome;
  signedIn: (user: { id: string; name?: string | undefined }) => void;
  signedOut: () => void;
  forget: () => void;
}

/**
 * The name every new player starts with. Stored in English; the UI shows it in
 * the player's language (profile.defaultName) until they choose their own.
 */
export const DEFAULT_NAME = 'Wanderer';

const GUEST_DEFAULTS = {
  status: 'guest' as SessionStatus,
  userId: null,
  name: DEFAULT_NAME,
  house: 'crimson' as House,
  bests: {} as Partial<Record<Lang, number>>,
  xp: 0,
  daily: { last: null, streak: 0, best: 0 } as StreakState,
  dailyScores: {} as Partial<Record<Lang, Record<string, number>>>,
  stats: { rounds: 0, words: 0, bestWord: null as { word: string; points: number } | null },
};

const KEEP_DAILIES = 60;

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...GUEST_DEFAULTS,

      setName: (name) => set({ name: name.trim().slice(0, 16) || DEFAULT_NAME }),
      setHouse: (house) => set({ house }),

      recordRound: (r) => {
        const s = get();
        const xpGained = xpForRound(r.points, r.daily);
        const rankBefore = rankFor(s.xp).id;
        const xp = s.xp + xpGained;
        const rankAfter = rankFor(xp).id;
        const newBest = r.points > (s.bests[r.lang] ?? 0) && r.points > 0;
        const daily = r.daily ? recordDaily(s.daily, r.day) : s.daily;
        let dailyScores = s.dailyScores;
        if (r.daily) {
          const mine = s.dailyScores[r.lang] ?? {};
          const keys = Object.keys(mine).sort().slice(-(KEEP_DAILIES - 1));
          const kept: Record<string, number> = Object.fromEntries(keys.map((k) => [k, mine[k]!]));
          kept[r.day] = r.points;
          dailyScores = { ...s.dailyScores, [r.lang]: kept };
        }
        const prevBest = s.stats.bestWord;
        const bestWord =
          r.bestWord && (!prevBest || r.bestWord.points > prevBest.points) ? r.bestWord : prevBest;
        set({
          xp,
          bests: newBest ? { ...s.bests, [r.lang]: r.points } : s.bests,
          daily,
          dailyScores,
          stats: { rounds: s.stats.rounds + 1, words: s.stats.words + r.words, bestWord },
        });
        return {
          xpGained, rankBefore, rankAfter,
          promoted: rankAfter !== rankBefore,
          newBest,
          streak: r.daily ? daily.streak : 0,
        };
      },

      signedIn: ({ id, name }) =>
        set((s) => ({ status: 'signed-in', userId: id, name: name?.trim() || s.name })),

      // Signing out keeps the local profile: the guest who remains is the same
      // person, and wiping their records would read as data loss.
      signedOut: () => set({ status: 'guest', userId: null }),

      forget: () => set({ ...GUEST_DEFAULTS }),
    }),
    {
      name: 'kow.session',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (old, version) => {
        type V2 = Omit<typeof GUEST_DEFAULTS, 'bests' | 'dailyScores'> & {
          localBest?: number; dailyScores?: Record<string, number>;
        };
        let o = (old ?? {}) as Partial<V2>;
        // v1 (Oct 2) had no xp/daily/stats, and stored scores on the old
        // 2-decimal scale (17.32). Points are now whole numbers x10 (173), so
        // the best is rescaled - otherwise any new round would beat an old best
        // by accident and show a false "new best", and Home would print a decimal.
        if (version < 2) o = { ...GUEST_DEFAULTS, ...o, localBest: Math.round((o.localBest ?? 0) * 10) } as Partial<V2>;
        // v2 had one best and one siege history, all English: there was no
        // other language. They become the English entries.
        if (version < 3) {
          const { localBest = 0, dailyScores = {}, ...rest } = o;
          return {
            ...GUEST_DEFAULTS, ...rest,
            bests: localBest > 0 ? { en: localBest } : {},
            dailyScores: Object.keys(dailyScores).length > 0 ? { en: dailyScores } : {},
          };
        }
        return o as unknown as typeof GUEST_DEFAULTS;
      },
    }
  )
);
