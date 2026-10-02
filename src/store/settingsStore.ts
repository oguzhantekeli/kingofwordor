import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Difficulty } from '../core/types';

export type InputMethod = 'touch' | 'keyboard';

interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  difficulty: Difficulty;
  language: string;
  /** Recorded on every round but never scored on (audit §7). */
  inputMethod: InputMethod;
  setSoundEnabled: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  setDifficulty: (v: Difficulty) => void;
  setLanguage: (v: string) => void;
  setInputMethod: (v: InputMethod) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      hapticsEnabled: true,
      difficulty: 'knight',
      language: 'en',
      inputMethod: 'keyboard',
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setLanguage: (language) => set({ language }),
      setInputMethod: (inputMethod) => set({ inputMethod }),
    }),
    { name: 'kow.settings', storage: createJSONStorage(() => localStorage) }
  )
);
