/**
 * A tiny channel from gameplay to the battlefield. The Play screen says what
 * happened; whichever Battlefield is mounted decides how to show it. Keeps the
 * game logic free of canvas references and the canvas free of game state.
 */
type Listener = (e: BattleEvent) => void;
export type BattleEvent = { type: 'win' } | { type: 'loss' } | { type: 'intensity'; value: number };

const listeners = new Set<Listener>();

export const battle = {
  win: () => emit({ type: 'win' }),
  loss: () => emit({ type: 'loss' }),
  intensity: (value: number) => emit({ type: 'intensity', value }),
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

function emit(e: BattleEvent): void {
  for (const fn of listeners) fn(e);
}
