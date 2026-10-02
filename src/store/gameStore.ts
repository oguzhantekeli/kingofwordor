import { create } from 'zustand';
import type { GameData } from '../core/load';
import { Round, configFor } from '../core/round';
import type { Difficulty, Prompt, Submission } from '../core/types';

export type Screen =
  | 'loading' | 'welcome' | 'countdown' | 'playing'
  | 'results' | 'credits' | 'settings' | 'profile' | 'error';

interface GameState {
  screen: Screen;
  data: GameData | null;
  loadError: string | null;
  round: Round | null;
  prompt: Prompt | null;
  submissions: readonly Submission[];
  totalScore: number;
  /** Absolute deadline; remaining time is derived, never accumulated (plan §7.1). */
  endsAt: number;
  lastResult: Submission | null;

  setData: (data: GameData) => void;
  setLoadError: (message: string) => void;
  goto: (screen: Screen) => void;
  startRound: (difficulty: Difficulty, seed?: number) => void;
  submit: (word: string) => Submission | null;
  endRound: () => void;
}

export const useGame = create<GameState>()((set, get) => ({
  screen: 'loading',
  data: null,
  loadError: null,
  round: null,
  prompt: null,
  submissions: [],
  totalScore: 0,
  endsAt: 0,
  lastResult: null,

  setData: (data) => set({ data, screen: 'welcome', loadError: null }),
  setLoadError: (loadError) => set({ loadError, screen: 'error' }),
  goto: (screen) => set({ screen }),

  startRound: (difficulty, seed = Math.floor(Math.random() * 0x7fffffff)) => {
    const { data } = get();
    if (!data) return;
    const config = configFor(difficulty, seed);
    const round = new Round(data.dict, config, {
      pools: data.pools,
      viability: data.viability,
    });
    set({
      round,
      prompt: round.state.prompt,
      submissions: [],
      totalScore: 0,
      lastResult: null,
      endsAt: Date.now() + config.durationMs,
      screen: 'countdown',
    });
  },

  submit: (word) => {
    const { round, endsAt } = get();
    if (!round || round.state.finished) return null;
    const elapsed = round.config.durationMs - Math.max(0, endsAt - Date.now());
    const { state, submission } = round.submit(word, Math.round(elapsed));
    set({
      prompt: state.prompt,
      submissions: state.submissions,
      totalScore: state.totalScore,
      lastResult: submission,
    });
    return submission;
  },

  endRound: () => {
    const { round } = get();
    round?.finish();
    set({ screen: 'results' });
  },
}));
