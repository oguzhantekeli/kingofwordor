import { describe, expect, it } from 'vitest';
import { createScene, nudge, setIntensity, step, type Scene } from '../scene';

const W = 180, H = 390;
const run = (s: Scene, seconds: number, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) step(s, dt);
};

describe('battlefield scene', () => {
  it('lays out a near and a far rank across the width', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 1 });
    expect(s.duels.some((d) => d.far)).toBe(true);
    expect(s.duels.some((d) => !d.far)).toBe(true);
    for (const d of s.duels) {
      expect(d.realm.x).toBeGreaterThanOrEqual(-16);
      expect(d.horde.x).toBeLessThanOrEqual(W);
    }
  });

  it('is deterministic for a seed', () => {
    const a = createScene({ w: W, h: H, ground: 0.35, seed: 42 });
    const b = createScene({ w: W, h: H, ground: 0.35, seed: 42 });
    run(a, 20); run(b, 20);
    expect(a.tally).toEqual(b.tally);
    expect(a.particles.length).toBe(b.particles.length);
  });

  it('soldiers actually fall and are replaced over time', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 7 });
    run(s, 60);
    expect(s.tally.realmFalls + s.tally.hordeFalls).toBeGreaterThan(5);
  });

  it('NO DUEL EVER STALLS: every duel keeps producing falls over 5 minutes', () => {
    // The bug this guards: a newcomer arriving on guard while the survivor is
    // also on guard - neither attacks again and that duel freezes forever.
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 99, intensity: 0.5 });
    const seen = new Map<number, number>();
    const snapshot = () => s.duels.map((d) => `${d.realm.anim}${d.realm.frame}|${d.horde.anim}${d.horde.frame}|${d.realm.x.toFixed(0)}`);
    let last = snapshot();
    for (let t = 0; t < 300; t += 1 / 30) {
      step(s, 1 / 30);
      if (Math.round(t * 30) % 30 === 0) {
        const now = snapshot();
        now.forEach((v, i) => { if (v !== last[i]) seen.set(i, t); });
        last = now;
      }
    }
    // every duel changed state within the final 10 seconds
    for (let i = 0; i < s.duels.length; i++) {
      expect(seen.get(i), `duel ${i} froze`).toBeGreaterThan(290);
    }
  });

  it('nudge(win) makes a Horde soldier fall soon', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 3 });
    run(s, 2);
    const before = s.tally.hordeFalls;
    nudge(s, 'win');
    run(s, 3);
    expect(s.tally.hordeFalls).toBeGreaterThan(before);
  });

  it('nudge(loss) costs the realm a soldier', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 4 });
    run(s, 2);
    const before = s.tally.realmFalls;
    nudge(s, 'loss');
    run(s, 3);
    expect(s.tally.realmFalls).toBeGreaterThan(before);
  });

  it('higher intensity produces more embers', () => {
    const calm = createScene({ w: W, h: H, ground: 0.35, seed: 5, intensity: 0 });
    const hot = createScene({ w: W, h: H, ground: 0.35, seed: 5, intensity: 1 });
    let calmEmbers = 0, hotEmbers = 0;
    for (let i = 0; i < 600; i++) {
      step(calm, 1 / 30); step(hot, 1 / 30);
      calmEmbers += calm.particles.filter((p) => p.kind === 'ember').length;
      hotEmbers += hot.particles.filter((p) => p.kind === 'ember').length;
    }
    expect(hotEmbers).toBeGreaterThan(calmEmbers * 1.5);
  });

  it('particle count is capped (memory stays bounded)', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 6, intensity: 1 });
    for (let i = 0; i < 40; i++) { nudge(s, 'win'); nudge(s, 'loss'); }
    run(s, 120);
    expect(s.particles.length).toBeLessThanOrEqual(160);
  });

  it('a huge dt (backgrounded tab) does not fast-forward the war', () => {
    const s = createScene({ w: W, h: H, ground: 0.35, seed: 8 });
    step(s, 3600);
    expect(s.time).toBeLessThanOrEqual(0.25);
  });

  it('setIntensity clamps to 0..1', () => {
    const s = createScene({ w: W, h: H, ground: 0.35 });
    setIntensity(s, 5); expect(s.intensity).toBe(1);
    setIntensity(s, -2); expect(s.intensity).toBe(0);
  });
});
