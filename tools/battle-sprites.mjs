/**
 * The battlefield cast: foot soldiers of two hosts, and fire.
 *
 * These are the "warriors fighting in the distance" from the brief. They are
 * deliberately small (16x20) - they sit behind the game, never in front of it,
 * and a background that competes with the prompt costs the player time in a
 * timed round. Detail goes into silhouette and pose, not into texture.
 *
 * Realm soldiers are drawn in the player's house colours, so the army on the
 * field is visibly theirs. The Horde is one palette: dark iron, horned helms,
 * ash-red rags - a generic dark host, not any specific franchise's.
 *
 * Every frame is deterministic: same code, same bytes, on any machine.
 */
import { Px, mix } from './pixel.mjs';
import { HOUSES } from './knight.mjs';

export const SW = 16;
export const SH = 20;
export const FW = 12;
export const FH = 18;

const STEEL = { hi: '#D8DBEE', base: '#9EA1BF', mid: '#6E7192', low: '#45475E', dark: '#2A2B3A' };
const IRON = { hi: '#8A8378', base: '#5E5850', mid: '#423D38', low: '#2C2925', dark: '#1A1816' };
const HORDE = { hi: '#A8483A', base: '#6E2A22', low: '#3E1712', charge: '#C9B48A' };
const OUTLINE = '#0E0A08';

/** Seeded PRNG so fire flicker is identical on every build. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ soldiers

/**
 * One soldier frame, facing right.
 * pose: { sword: angle in degrees (0 = straight ahead, -90 = up),
 *         stride: 0|1|2, dy: body drop in px, lean: px, guard: shield raised,
 *         down: 0 standing | 1 kneeling | 2 lying }
 */
function soldier(side, pal, pose) {
  const px = new Px(SW, SH);
  const helmK = side === 'realm'
    ? { H: STEEL.hi, I: STEEL.base, M: STEEL.mid, D: STEEL.dark, C: pal.base, c: pal.hi }
    : { H: IRON.hi, I: IRON.base, M: IRON.mid, D: IRON.dark, C: '#D9CBA8', c: '#F2E6C8' };
  const bodyK = side === 'realm'
    ? { P: pal.base, Q: pal.hi, R: pal.low, G: pal.charge, L: STEEL.low, M: STEEL.mid }
    : { P: HORDE.base, Q: HORDE.hi, R: HORDE.low, G: HORDE.charge, L: IRON.low, M: IRON.mid };
  const metal = side === 'realm' ? STEEL : IRON;

  if (pose.down === 2) {
    // lying: a horizontal silhouette on the ground line
    px.stamp(1, 15, [
      '..IIH..PPPPPP.LL',
      '.IIDIIPQPGPPRLLM',
      '..MM...RRRRRR.MM',
    ], { ...helmK, ...bodyK });
    px.line(9, 18, 14, 18, metal.mid);
    px.outline(OUTLINE);
    return px;
  }

  const x = 4 + (pose.lean || 0);
  const y = 1 + (pose.dy || 0) + (pose.down === 1 ? 4 : 0);

  // helm
  if (side === 'realm') {
    px.stamp(x, y, [
      '.c...',
      'CIII.',
      'HIIIM',
      'HDDIM',
      'HIIIM',
      '.MMM.',
    ], helmK);
  } else {
    // horned helm: the horns are the whole read at this size
    px.stamp(x - 1, y, [
      'C.....C',
      'CIIII.C',
      '.HIIIM.',
      '.HDDIM.',
      '.HIIIM.',
      '..MMM..',
    ], helmK);
  }

  // torso / tabard
  px.stamp(x, y + 6, [
    'MPPPL',
    'QPGPR',
    'QPPPR',
    'QPPPR',
    'MRRRL',
  ], bodyK);

  // legs
  const legTop = y + 11;
  if (pose.down === 1) {
    px.rect(x, legTop, 5, 2, metal.low);          // folded under
    px.rect(x - 1, legTop + 2, 3, 1, metal.dark);
    px.rect(x + 3, legTop + 2, 3, 1, metal.dark);
  } else {
    const s = pose.stride || 0;
    px.rect(x, legTop, 2, 6 - s, metal.mid);
    px.rect(x - (s > 0 ? 1 : 0), legTop + 6 - s, 3, 1, metal.dark);
    px.rect(x + 3, legTop, 2, 6 + (s > 1 ? 0 : s), metal.low);
    px.rect(x + 3 + (s > 0 ? 1 : 0), legTop + 6 + (s > 1 ? 0 : s) - 0, 3, 1, metal.dark);
  }

  // shield on the far arm
  const sx = x - 2 + (pose.guard ? 1 : 0);
  const sy = y + 6 - (pose.guard ? 2 : 0);
  px.stamp(sx, sy, [
    'EEE',
    'EPE',
    'EGE',
    'EPE',
    '.E.',
  ], { E: metal.hi, P: bodyK.P, G: bodyK.G });

  // sword arm + blade, from the shoulder at the given angle
  if (pose.sword !== null && pose.sword !== undefined) {
    const shx = x + 4, shy = y + 7;
    const a = (pose.sword * Math.PI) / 180;
    const hx = shx + Math.round(Math.cos(a) * 2), hy = shy + Math.round(Math.sin(a) * 2);
    px.line(shx, shy, hx, hy, metal.mid);
    const len = side === 'realm' ? 7 : 6;
    const tx = hx + Math.round(Math.cos(a) * len), ty = hy + Math.round(Math.sin(a) * len);
    px.line(hx, hy, tx, ty, side === 'realm' ? STEEL.hi : IRON.hi);
    px.set(hx, hy, '#D9A441'); // hilt
    if (side === 'horde') px.set(tx, ty, '#B8B0A0'); // the notched tip of an axe-blade
  }

  px.outline(OUTLINE);
  return px;
}

/**
 * Animations. Angles: 0 = level, negative = raised. The attack is a raise,
 * a hard downward cut and a follow-through; the read at 15 fps is a chop.
 */
export const SOLDIER_ANIMS = {
  walk:   [ { sword: -50, stride: 0 }, { sword: -55, stride: 1 }, { sword: -50, stride: 2 }, { sword: -45, stride: 1 } ],
  attack: [ { sword: -100, stride: 1, lean: -1 }, { sword: -60, stride: 2 }, { sword: 10, stride: 2, lean: 1 }, { sword: 30, stride: 1, lean: 1 } ],
  block:  [ { sword: -30, stride: 0, guard: true }, { sword: -25, stride: 0, guard: true, lean: -1 } ],
  fall:   [ { sword: 40, stride: 0, lean: -1 }, { sword: 70, down: 1 }, { sword: null, down: 1, dy: 1 }, { sword: null, down: 2 } ],
};

export function soldierFrame(side, palette, pose) {
  return soldier(side, palette, pose);
}

export { HOUSES, HORDE };

// ---------------------------------------------------------------- fire

/**
 * A flame, 12x18, as a column of hot noise that narrows upward. Six frames
 * with independent seeds; looped at ~10 fps the flicker reads as fire.
 */
export function fireFrame(i) {
  const px = new Px(FW, FH);
  const r = rng(9001 + i * 131);
  const ramp = ['#FFF2B0', '#FFD45A', '#F59A2E', '#D9541E', '#8E2A14'];
  for (let y = FH - 1; y >= 0; y--) {
    const t = 1 - y / (FH - 1);                  // 0 at the base, 1 at the tip
    const half = Math.max(0, (FW / 2) * (1 - t * 0.92) + (r() - 0.5) * 2.2);
    const cx = FW / 2 - 0.5 + Math.sin(t * 5 + i * 1.3) * t * 1.6;
    for (let x = 0; x < FW; x++) {
      const d = Math.abs(x - cx) / Math.max(half, 0.01);
      if (d > 1) continue;
      // hotter at the centre and the base
      const heat = (1 - d) * 0.7 + (1 - t) * 0.6 + (r() - 0.5) * 0.25;
      const idx = heat > 1.05 ? 0 : heat > 0.82 ? 1 : heat > 0.58 ? 2 : heat > 0.36 ? 3 : 4;
      px.set(x, y, ramp[idx]);
    }
  }
  return px;
}
export const FIRE_FRAMES = 6;

// helper so the palette mixing util stays referenced for future shading passes
export const _mix = mix;
