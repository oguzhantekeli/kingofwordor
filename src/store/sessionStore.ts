import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { House } from '../ui/sprites.generated';

export type SessionStatus = 'guest' | 'signed-in';

/**
 * Identity, guest-first.
 *
 * Nobody is asked to sign in to play. A guest gets a local profile - a name
 * they can change and a house colour - and plays the solo run. Signing in is
 * what posts a score to a ladder, carries progress to another phone, and
 * unlocks the duel. That ask is made after a round worth keeping, never before
 * the first one.
 *
 * `userId` is null until Google sign-in lands; everything else works without it.
 */
interface SessionState {
  status: SessionStatus;
  /** Supabase user id once signed in. */
  userId: string | null;
  name: string;
  house: House;
  /** Best solo score seen on this device, so a guest still has a record. */
  localBest: number;

  setName: (name: string) => void;
  setHouse: (house: House) => void;
  recordScore: (score: number) => void;
  signedIn: (user: { id: string; name?: string | undefined }) => void;
  signedOut: () => void;
  /** Wipes the local profile. The account side of deletion is the server's job. */
  forget: () => void;
}

const GUEST_DEFAULTS = {
  status: 'guest' as SessionStatus,
  userId: null,
  name: 'Wanderer',
  house: 'crimson' as House,
  localBest: 0,
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      ...GUEST_DEFAULTS,

      setName: (name) => set({ name: name.trim().slice(0, 16) || 'Wanderer' }),
      setHouse: (house) => set({ house }),
      recordScore: (score) => set((s) => (score > s.localBest ? { localBest: score } : s)),

      signedIn: ({ id, name }) =>
        set((s) => ({ status: 'signed-in', userId: id, name: name?.trim() || s.name })),

      // Signing out keeps the local profile: the guest who remains is the same
      // person, and wiping their best score would read as data loss.
      signedOut: () => set({ status: 'guest', userId: null }),

      forget: () => set({ ...GUEST_DEFAULTS }),
    }),
    { name: 'kow.session', storage: createJSONStorage(() => localStorage) }
  )
);
