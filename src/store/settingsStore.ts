import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Difficulty } from '../core/types';
import { detectLanguage, isLang, type Lang } from '../core/lang';

export type InputMethod = 'touch' | 'keyboard';

interface SettingsState {
  /** Sound effects. */
  soundEnabled: boolean;
  /** The battle theme and the battlefield ambience. */
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  difficulty: Difficulty;
  /** The game's language: the interface AND the dictionary words are played in. */
  language: Lang;
  /** Recorded on every round but never scored on (audit §7). */
  inputMethod: InputMethod;
  setSoundEnabled: (v: boolean) => void;
  setMusicEnabled: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  setDifficulty: (v: Difficulty) => void;
  setLanguage: (v: Lang) => void;
  setInputMethod: (v: InputMethod) => void;
}

/** First launch speaks the phone's language when the game has it. */
function deviceLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  return detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      difficulty: 'knight',
      language: deviceLanguage(),
      inputMethod: 'keyboard',
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setLanguage: (language) => set({ language }),
      setInputMethod: (inputMethod) => set({ inputMethod }),
    }),
    {
      name: 'kow.settings',
      storage: createJSONStorage(() => localStorage),
      // v0 stored language as a free string that only ever held 'en'. A
      // stored value the game cannot play is replaced, never trusted: it picks
      // which dictionary file gets fetched.
      version: 1,
      migrate: (old) => {
        const o = (old ?? {}) as Partial<SettingsState>;
        return { ...o, language: isLang(o.language) ? o.language : deviceLanguage() } as SettingsState;
      },
    }
  )
);
