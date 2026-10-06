import { expect, it } from 'vitest';
import { createScene, nudge, step } from '../scene';

/**
 * Feedback latency is the whole point of tying the battle to the round: if the
 * soldier falls seconds after the word, the player has moved on and the two
 * never connect. Measured mid-round (after five earlier nudges, one every
 * 2.5 s) across 300 seeds. Before the fix: p90 = 3.73 s.
 */
it('LATENCY: a scored word drops a soldier near-instantly in realistic play', () => {
  for (const outcome of ['win', 'loss'] as const) {
    const lat: number[] = [];
    let never = 0;
    let instant = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = createScene({ w: 180, h: 390, ground: 0.35, seed });
      for (let k = 0; k < 5; k++) {
        for (let t = 0; t < 2.5; t += 1 / 30) step(s, 1 / 30);
        nudge(s, seed % 2 ? 'win' : 'loss');
      }
      for (let t = 0; t < 2.5; t += 1 / 30) step(s, 1 / 30);
      const key = outcome === 'win' ? 'hordeFalls' : 'realmFalls';
      const before = s.tally[key];
      nudge(s, outcome);
      if (s.tally[key] !== before) { instant++; lat.push(0); continue; }
      let t = 0;
      for (; t < 10 && s.tally[key] === before; t += 1 / 30) step(s, 1 / 30);
      if (s.tally[key] === before) never++;
      else lat.push(t);
    }
    lat.sort((a, b) => a - b);
    const p99 = lat[Math.floor(0.99 * (lat.length - 1))]!;
    expect(never, `${outcome}: some nudges never resolved`).toBe(0);
    expect(instant / 300, `${outcome}: instant rate`).toBeGreaterThanOrEqual(0.8);
    expect(p99, `${outcome}: p99 latency`).toBeLessThanOrEqual(1.5);
  }
});
