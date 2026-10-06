import { create } from 'zustand';
import type { GameData } from '../core/load';
import { Round, SKIP_PENALTY_MS, configFor } from '../core/round';
import { dailySeed, dayKey } from '../core/progress';
import type { Difficulty, Prompt, Submission } from '../core/types';
import { useSession, type RoundOutcome } from './sessionStore';
import { submissionFromLog } from '../core/verify';

export type Screen =
  | 'loading' | 'welcome' | 'countdown' | 'playing'
  | 'results' | 'credits' | 'settings' | 'profile' | 'ladder' | 'error';

export type Mode = 'solo' | 'daily';

interface GameState {
  screen: Screen;
  data: GameData | null;
  loadError: string | null;
  round: Round | null;
  mode: Mode;
  /** The difficulty the current/last round was actually played at. */
  difficulty: Difficulty;
  /** dayKey the daily round belongs to. */
  day: string;
  prompt: Prompt | null;
  submissions: readonly Submission[];
  totalScore: number;
  /** Consecutive accepted words; drives the battle's intensity. */
  streak: number;
  bestStreak: number;
  /** Absolute deadline; remaining time is derived, never accumulated (plan §7.1). */
  endsAt: number;
  lastResult: Submission | null;
  /** What the finished round changed: XP, rank, record, daily streak. */
  outcome: RoundOutcome | null;
  /** Ladder posting state for the finished round (signed-in players only). */
  posting: 'idle' | 'sending' | 'posted' | 'failed';

  setData: (data: GameData) => void;
  setLoadError: (message: string) => void;
  goto: (screen: Screen) => void;
  startRound: (difficulty: Difficulty, seed?: number) => void;
  startDaily: (now?: Date) => void;
  /** Replay the last round's mode and difficulty (the results "again" button). */
  again: () => void;
  submit: (word: string) => Submission | null;
  skip: () => void;
  endRound: () => void;
}

export const useGame = create<GameState>()((set, get) => {
  const begin = (difficulty: Difficulty, seed: number, mode: Mode, day: string) => {
    const { data } = get();
    if (!data) return;
    const config = configFor(difficulty, seed);
    const round = new Round(data.dict, config, { pools: data.pools, viability: data.viability });
    set({
      round, mode, difficulty, day,
      prompt: round.state.prompt,
      submissions: [], totalScore: 0, streak: 0, bestStreak: 0,
      lastResult: null, outcome: null, posting: 'idle',
      endsAt: Date.now() + config.durationMs,
      screen: 'countdown',
    });
  };

  return {
    screen: 'loading',
    data: null,
    loadError: null,
    round: null,
    mode: 'solo',
    difficulty: 'knight',
    day: '',
    prompt: null,
    submissions: [],
    totalScore: 0,
    streak: 0,
    bestStreak: 0,
    endsAt: 0,
    lastResult: null,
    outcome: null,
    posting: 'idle',

    setData: (data) => set({ data, screen: 'welcome', loadError: null }),
    setLoadError: (loadError) => set({ loadError, screen: 'error' }),
    goto: (screen) => set({ screen }),

    startRound: (difficulty, seed = Math.floor(Math.random() * 0x7fffffff)) =>
      begin(difficulty, seed, 'solo', ''),

    // Same prompts for everyone today; always at the default rank so the
    // ladder compares like with like.
    startDaily: (now = new Date()) => {
      const day = dayKey(now);
      begin('knight', dailySeed(day), 'daily', day);
    },

    again: () => {
      const { mode, difficulty } = get();
      if (mode === 'daily') { set({ screen: 'welcome' }); return; } // one siege a day
      begin(difficulty, Math.floor(Math.random() * 0x7fffffff), 'solo', '');
    },

    submit: (word) => {
      const { round, endsAt, streak, bestStreak } = get();
      if (!round || round.state.finished) return null;
      const elapsed = round.config.durationMs - Math.max(0, endsAt - Date.now());
      const { state, submission } = round.submit(word, Math.round(elapsed));
      const nextStreak = submission.accepted ? streak + 1 : 0;
      set({
        prompt: state.prompt,
        submissions: state.submissions,
        totalScore: state.totalScore,
        lastResult: submission,
        streak: nextStreak,
        bestStreak: Math.max(bestStreak, nextStreak),
      });
      return submission;
    },

    skip: () => {
      const { round, endsAt } = get();
      if (!round || round.state.finished) return;
      const elapsed = round.config.durationMs - Math.max(0, endsAt - Date.now());
      const { state, submission } = round.skip(Math.round(elapsed));
      set({
        prompt: state.prompt,
        submissions: state.submissions,
        lastResult: submission,
        streak: 0,
        endsAt: endsAt - SKIP_PENALTY_MS,
      });
    },

    endRound: () => {
      const { round, mode, day, totalScore, submissions, screen } = get();
      // idempotent: the timer and the give-up button can both land here
      if (screen === 'results' || !round) return;
      round.finish();
      const accepted = submissions.filter((s) => s.accepted);
      const best = accepted.reduce<Submission | null>(
        (b, s) => (b === null || s.points > b.points ? s : b), null);
      const outcome = useSession.getState().recordRound({
        points: totalScore,
        words: accepted.length,
        bestWord: best ? { word: best.word, points: best.points } : null,
        daily: mode === 'daily',
        day,
      });
      set({ screen: 'results', outcome });

      // Signed in: send what happened, not what it earned. The server replays
      // the events and stores its own score (core/verify.ts). Fire-and-forget:
      // the results screen never waits on the network.
      if (useSession.getState().status === 'signed-in') {
        const sub = submissionFromLog({
          mode, day, seed: round.config.seed, difficulty: round.config.difficulty,
          log: submissions, claimedScore: totalScore,
        });
        set({ posting: 'sending' });
        void import('../platform/supabase')
          .then(({ isConfigured, submitRound }) => {
            if (!isConfigured()) { set({ posting: 'idle' }); return null; }
            return submitRound(sub).then((r) => set({ posting: r.ok ? 'posted' : 'failed' }));
          })
          .catch(() => set({ posting: 'failed' }));
      }
    },
  };
});
