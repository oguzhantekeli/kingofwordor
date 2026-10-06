/**
 * The battlefield as a pure simulation: no DOM, no canvas, no clock.
 *
 * The caller owns time and passes `dt`; given the same seed and the same
 * sequence of calls the scene evolves identically, which is what makes it
 * testable. The renderer (render.ts) only reads this state.
 *
 * The battle is not decoration. `nudge('win')` makes the next duel go the
 * player's way and `nudge('loss')` costs them a soldier, so the field shows how
 * the round is going without a single extra word on screen. `intensity` (0..1)
 * rises with a scoring streak and thickens the embers and the fighting.
 */
import { SOLDIER_ANIMS, type SoldierAnim } from '../sprites.generated';

export type Side = 'realm' | 'horde';

export interface Fighter {
  side: Side;
  anim: SoldierAnim;
  frame: number;
  /** Logical x of the sprite's left edge. */
  x: number;
  /** Seconds until the next frame. */
  wait: number;
  /** Lies on the field this long after falling, then fades out. */
  downFor: number;
  /** 1 = solid, fades to 0 before the soldier is replaced. */
  alpha: number;
  /** Walking in from the edge toward `post`. */
  post: number;
}

export interface Duel {
  realm: Fighter;
  horde: Fighter;
  /** Exchanges left before someone falls. */
  exchanges: number;
  /** Who falls when the exchanges run out; set by nudge() or chance. */
  loser: Side | null;
  /** Far rank: drawn darker and higher, never nudged. */
  far: boolean;
}

export type ParticleKind = 'ember' | 'dust' | 'smoke' | 'ash';

export interface Particle {
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number;
}

export interface Scene {
  w: number;
  h: number;
  groundY: number;
  intensity: number;
  time: number;
  duels: Duel[];
  particles: Particle[];
  /** Fixed fire positions: castle fires and burning debris on the field. */
  fires: { x: number; y: number; frame: number; wait: number; big: boolean }[];
  rng: () => number;
  /** Recycled particle objects. The hot path allocates nothing per frame. */
  pool: Particle[];
  /** Running tally since the scene started, for tests and for the HUD later. */
  tally: { realmFalls: number; hordeFalls: number };
}

const FPS = 12;
const FRAME_S = 1 / FPS;
const MAX_PARTICLES = 160;
const SW = 16;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fighter(side: Side, x: number, post: number): Fighter {
  return { side, anim: 'walk', frame: 0, x, wait: FRAME_S, downFor: 0, alpha: 1, post };
}

export interface SceneOptions {
  w: number;
  h: number;
  /** 0..1, where the battle line sits down the screen. */
  ground: number;
  seed?: number;
  intensity?: number;
}

export function createScene(opts: SceneOptions): Scene {
  const rng = mulberry32(opts.seed ?? 1);
  const groundY = Math.round(opts.h * opts.ground);
  const scene: Scene = {
    w: opts.w, h: opts.h, groundY,
    intensity: clamp01(opts.intensity ?? 0.35),
    time: 0, duels: [], particles: [], fires: [], rng, pool: [],
    tally: { realmFalls: 0, hordeFalls: 0 },
  };
  layoutDuels(scene);
  // castle fires sit on the horizon; field fires on the battle line
  const horizon = groundY - 26;
  scene.fires = [
    { x: Math.round(opts.w * 0.62), y: horizon - 30, frame: 0, wait: 0, big: true },
    { x: Math.round(opts.w * 0.74), y: horizon - 22, frame: 3, wait: 0, big: true },
    { x: Math.round(opts.w * 0.08), y: groundY - 14, frame: 1, wait: 0, big: false },
    { x: Math.round(opts.w * 0.9), y: groundY - 12, frame: 4, wait: 0, big: false },
  ];
  return scene;
}

/** Lay duels evenly across the width: a near rank and a far rank. */
function layoutDuels(scene: Scene): void {
  const near = Math.max(2, Math.floor(scene.w / 52));
  const far = Math.max(2, Math.floor(scene.w / 44));
  scene.duels = [];
  const make = (count: number, isFar: boolean) => {
    const span = scene.w / count;
    for (let i = 0; i < count; i++) {
      const mid = Math.round(span * (i + 0.5) + (isFar ? span * 0.25 : 0));
      const realmPost = mid - SW + 3;
      const hordePost = mid - 3;
      const d: Duel = {
        realm: fighter('realm', realmPost, realmPost),
        horde: fighter('horde', hordePost, hordePost),
        exchanges: exchangesFor(scene, isFar),
        loser: null,
        far: isFar,
      };
      // stagger so the field never moves in lockstep
      d.realm.anim = 'attack';
      d.realm.frame = Math.floor(scene.rng() * 4);
      d.horde.anim = 'block';
      d.horde.frame = Math.floor(scene.rng() * 2);
      scene.duels.push(d);
    }
  };
  make(far, true);
  make(near, false);
}

/**
 * Move the battle line without restarting the battle. Used when the element
 * the line is anchored to (the hero's feet) moves; recreating the scene would
 * resurrect every fallen soldier mid-round.
 */
export function setGround(scene: Scene, groundY: number): void {
  const y = Math.round(groundY);
  const delta = y - scene.groundY;
  if (delta === 0) return;
  scene.groundY = y;
  for (const f of scene.fires) f.y += delta;
}

export function setIntensity(scene: Scene, v: number): void {
  scene.intensity = clamp01(v);
}

/**
 * Tie the field to the round. A win makes a near duel end with a Horde soldier
 * falling on its next exchange; a loss costs the realm one.
 */
export function nudge(scene: Scene, outcome: 'win' | 'loss'): void {
  const loser: Side = outcome === 'win' ? 'horde' : 'realm';
  const near = scene.duels.filter((d) => !d.far && d.loser === null);
  const live = near.filter((d) => atPost(d.realm) && atPost(d.horde));
  let d: Duel | undefined;
  if (live.length > 0) {
    // Resolve NOW: the winner lands the blow on the next frame. Waiting for the
    // exchange to finish measured p90 = 3.7 s - long enough that the player
    // has typed another word and no longer connects the two.
    d = live[Math.floor(scene.rng() * live.length)]!;
    const winner = loser === 'horde' ? d.realm : d.horde;
    winner.anim = 'attack';
    winner.frame = 2;
    winner.wait = FRAME_S;
    fell(scene, d, loser);
    return;
  } else {
    // nobody is mid-fight: queue it on the duel that will be ready soonest
    d = near.slice().sort((a, b) => readyIn(a) - readyIn(b))[0];
  }
  if (!d) return;
  d.loser = loser;
  d.exchanges = Math.min(d.exchanges, 1);
}

export function step(scene: Scene, dt: number): void {
  const clamped = Math.min(dt, 0.25); // a backgrounded tab must not fast-forward a war
  scene.time += clamped;
  for (let i = 0; i < scene.duels.length; i++) stepDuel(scene, scene.duels[i]!, clamped);
  for (const f of scene.fires) {
    f.wait -= clamped;
    if (f.wait <= 0) {
      f.frame = (f.frame + 1) % 6;
      f.wait = 0.09 + scene.rng() * 0.04;
    }
  }
  spawnAmbient(scene, clamped);
  stepParticles(scene, clamped);
}

function stepDuel(scene: Scene, d: Duel, dt: number): void {
  // two calls, not `for (const f of [d.realm, d.horde])`: that allocated an
  // array per duel per frame, and the garbage showed up as periodic GC pauses
  advance(scene, d, d.realm, dt);
  advance(scene, d, d.horde, dt);
}

function advance(scene: Scene, d: Duel, f: Fighter, dt: number): void {
  // walking in from the edge to take the fallen soldier's place
  if (f.anim === 'walk') {
    if (f.alpha < 1) f.alpha = Math.min(1, f.alpha + dt * 2.5);
    const dir = f.post > f.x ? 1 : -1;
    f.x += dir * 14 * dt;
    if ((dir > 0 && f.x >= f.post) || (dir < 0 && f.x <= f.post)) {
      f.x = f.post;
      // A newcomer always opens with a swing. If it arrived on guard while the
      // survivor was also on guard, neither would ever attack and the duel
      // would freeze - block only ever turns into attack at the end of a cycle.
      f.anim = 'attack';
      f.frame = 0;
      const other = f.side === 'realm' ? d.horde : d.realm;
      if (other.anim !== 'fall' && other.anim !== 'walk') { other.anim = 'block'; other.frame = 0; }
    }
  }

  if (f.anim === 'fall' && f.frame === SOLDIER_ANIMS.fall.frames - 1) {
    f.downFor -= dt;
    if (f.downFor <= 0) {
      f.alpha -= dt * 2.5;
      if (f.alpha <= 0) respawn(scene, d, f);
    }
    return;
  }

  f.wait -= dt;
  if (f.wait > 0) return;
  f.wait += FRAME_S * (f.anim === 'walk' ? 1.4 : 1);
  const frames = SOLDIER_ANIMS[f.anim].frames;
  f.frame += 1;

  if (f.anim === 'attack' && f.frame === 2) {
    // the blow lands: dust at the defender's feet
    const other = f.side === 'realm' ? d.horde : d.realm;
    puff(scene, other.x + 8, groundOf(scene, d), d.far ? 2 : 4);
  }

  if (f.frame < frames) return;
  f.frame = 0;

  if (f.anim === 'fall') {
    f.frame = frames - 1;
    return;
  }

  // An exchange completes when the realm soldier finishes a swing. Swap roles
  // so both sides attack and block in turn.
  if (f.anim === 'attack' && atPost(d.realm) && atPost(d.horde)) endExchange(scene, d);

  // Roles swap only while both stand at their post. A survivor must not swing
  // at a newcomer who is still walking up - that burned exchanges on thin air.
  if (atPost(d.realm) && atPost(d.horde)) {
    if (f.anim === 'attack') f.anim = 'block';
    else if (f.anim === 'block') f.anim = 'attack';
  }
}

function endExchange(scene: Scene, d: Duel): void {
  d.exchanges -= 1;
  if (d.exchanges > 0) return;
  const loser: Side =
    d.loser ?? (scene.rng() < 0.5 + (scene.intensity - 0.5) * 0.3 ? 'horde' : 'realm');
  fell(scene, d, loser);
}

function fell(scene: Scene, d: Duel, loser: Side): void {
  const f = loser === 'realm' ? d.realm : d.horde;
  const survivor = loser === 'realm' ? d.horde : d.realm;
  // the survivor stands on guard rather than hacking at a body
  if (survivor.anim !== 'attack') { survivor.anim = 'block'; survivor.frame = 0; }
  f.anim = 'fall';
  f.frame = 0;
  f.wait = FRAME_S * 1.3;
  // short enough that the near rank is rarely empty when the next word lands
  f.downFor = 0.8 + scene.rng() * 0.6;
  if (loser === 'realm') scene.tally.realmFalls++;
  else scene.tally.hordeFalls++;
  puff(scene, f.x + 8, groundOf(scene, d), d.far ? 3 : 7);
  d.loser = null;
}

/** How far behind its post a reinforcement appears. ~1.4 s of walking. */
const REINFORCE_GAP = 20;

function respawn(scene: Scene, d: Duel, f: Fighter): void {
  // Reinforcements step up from just behind the line and fade in. Walking from
  // the screen edge took up to ~12 s for the far duel - far too long for a
  // player to connect a word they just scored with the soldier who falls.
  const back = f.side === 'realm' ? -REINFORCE_GAP : REINFORCE_GAP;
  const fresh = fighter(f.side, f.post + back, f.post);
  fresh.alpha = 0;
  if (f.side === 'realm') d.realm = fresh;
  else d.horde = fresh;
  // a pending nudge resolves on the first exchange after the newcomer arrives
  d.exchanges = d.loser ? 1 : exchangesFor(scene, d.far);
  // the survivor keeps fighting the newcomer once it arrives
  const other = f.side === 'realm' ? d.horde : d.realm;
  if (other.anim !== 'walk') { other.anim = 'block'; other.frame = 0; }
}

/**
 * The near rank trades blows for a long time on its own, so that it is almost
 * always mid-fight when a word lands - the PLAYER decides who falls there. The
 * far rank resolves quickly and at random: that is the war going on around you.
 */
function exchangesFor(scene: Scene, far: boolean): number {
  return far ? 2 + Math.floor(scene.rng() * 4) : 7 + Math.floor(scene.rng() * 5);
}

function atPost(f: Fighter): boolean {
  return f.anim === 'attack' || f.anim === 'block';
}

/** Rough seconds until both fighters of a duel can trade blows again. */
function readyIn(d: Duel): number {
  const one = (f: Fighter) =>
    f.anim === 'walk' ? Math.abs(f.post - f.x) / 14
    : f.anim === 'fall' ? Math.max(0, f.downFor) + f.alpha / 2.5 + REINFORCE_GAP / 14
    : 0;
  return Math.max(one(d.realm), one(d.horde));
}

export function groundOf(scene: Scene, d: Duel): number {
  return d.far ? scene.groundY - 9 : scene.groundY;
}

// ------------------------------------------------------------ particles

/**
 * Spawn from the pool. At the cap the new particle is simply dropped: the old
 * `shift()` was O(n) per spawn, and a fresh object per particle fed the GC.
 */
function add(
  scene: Scene, kind: ParticleKind, x: number, y: number,
  vx: number, vy: number, max: number, size: number
): void {
  if (scene.particles.length >= MAX_PARTICLES) return;
  const p = scene.pool.pop() ?? ({} as Particle);
  p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = 0; p.max = max; p.size = size;
  scene.particles.push(p);
}

function puff(scene: Scene, x: number, y: number, n: number): void {
  const r = scene.rng;
  for (let i = 0; i < n; i++) {
    add(scene, 'dust', x + (r() - 0.5) * 8, y - r() * 2,
      (r() - 0.5) * 14, -4 - r() * 6, 0.5 + r() * 0.5, 1 + Math.floor(r() * 2));
  }
}

function spawnAmbient(scene: Scene, dt: number): void {
  const k = 0.4 + scene.intensity * 1.6;
  const r = scene.rng;
  for (let i = 0; i < scene.fires.length; i++) {
    const f = scene.fires[i]!;
    // embers rise from every fire, more of them as the round heats up
    if (r() < dt * (f.big ? 6 : 3) * k) {
      add(scene, 'ember', f.x + 6 + (r() - 0.5) * 6, f.y + 4,
        (r() - 0.5) * 6, -10 - r() * 14, 1.2 + r() * 1.6, 1);
    }
    // castle fires trail a smoke column
    if (f.big && r() < dt * 3) {
      add(scene, 'smoke', f.x + 6, f.y, 2 + r() * 2, -6 - r() * 3, 3 + r() * 2, 2);
    }
  }
  if (r() < dt * 2.5) add(scene, 'ash', r() * scene.w, -2, 1 + r() * 2, 4 + r() * 4, 8, 1);
}

/** In-place compaction: survivors slide down, the dead go back to the pool. */
function stepParticles(scene: Scene, dt: number): void {
  const arr = scene.particles;
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i]!;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'ember') p.vx += Math.sin(scene.time * 3 + p.y) * dt * 4;
    else if (p.kind === 'dust') p.vy += 18 * dt;
    else if (p.kind === 'smoke') p.size = 2 + Math.floor((p.life / p.max) * 4);
    if (p.life >= p.max || p.y < -8 || p.y > scene.h + 8) scene.pool.push(p);
    else arr[j++] = p;
  }
  arr.length = j;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
