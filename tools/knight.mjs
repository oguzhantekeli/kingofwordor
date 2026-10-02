/**
 * The knight: parts, poses and animations, drawn from code.
 *
 * No artist and no asset pack. The armour, heraldry and every animation frame
 * are drawn here from primitives and hand-placed pixel rows, so a palette swap
 * makes a new combatant and the whole cast re-renders identically on any
 * machine. tools/build-sprites.mjs is the CLI that writes the sheets.
 *
 * Read at 1x before changing anything: at 40x44 the silhouette is the whole
 * design. Shield, body and helm each need their own value so they do not merge
 * into one blob — that is why the shield carries a steel rim and the sword arm
 * is drawn in the darkest steel.
 */
import { Px } from './pixel.mjs';

const W = 46;
const H = 46;

// --------------------------------------------------------------- palettes

const STEEL = { hi: '#E8EAF7', base: '#AFB2CE', mid: '#7D80A0', low: '#4E5069', dark: '#33344A' };
const GOLD = { hi: '#F7E3AE', base: '#D9A441', low: '#8A6520' };
const SKIN = { hi: '#F0C79A', base: '#D39B6B' };
const DARK = '#120E0A';

/** A house: tabard, shield field, plume. `charge` is the device on the shield. */
export const HOUSES = {
  crimson: { hi: '#D45656', base: '#9B2C2C', low: '#5E1A1A', charge: GOLD.base },
  azure: { hi: '#5A86D6', base: '#2B4A7D', low: '#17294A', charge: '#E8EAF7' },
  forest: { hi: '#6FB45C', base: '#3E7A36', low: '#23461F', charge: GOLD.base },
  violet: { hi: '#9B74DE', base: '#5F3FA3', low: '#35215E', charge: '#F7E3AE' },
};

// ------------------------------------------------------------------ parts

/**
 * Great helm, 10x10, with a cross slit. Hand-placed: the slit is the single
 * feature that makes a ten-pixel head read as a knight rather than an egg,
 * and no procedural shape lands it on the right rows.
 */
function helm(px, x, y, house) {
  const K = { I: STEEL.base, H: STEEL.hi, M: STEEL.mid, L: STEEL.low, D: STEEL.dark };
  px.stamp(x, y, [
    '..IIIIII..',
    '.HIIIIIIM.',
    'HHIIIIIIMM',
    'HIIIDDIIIM',
    'HIIIDDIIIM',
    'HIDDDDDDIM',
    'HIIIDDIIIM',
    'HIIIIIIIIM',
    'MIIIIIIIIL',
    '.MMLLLLLL.',
  ], K);
  // crest: house colour, swept back, so the two sides read apart at a glance
  px.stamp(x + 2, y - 5, [
    '...QQ.',
    '..QPP.',
    '.QPPP.',
    'QPPP..',
    'QPP...',
  ], { P: house.base, Q: house.hi });
}

/** Tabard over mail: house field, gold chevron, mail edges down both sides. */
function torso(px, x, y, house) {
  const K = {
    I: STEEL.base, M: STEEL.mid, L: STEEL.low,
    P: house.base, Q: house.hi, R: house.low,
    G: house.charge,
  };
  px.stamp(x, y, [
    'MIIIIIIIIL',   // gorget
    'IQPPPPPPRL',
    'IQPPPPPPRL',
    'IQPPGGPPRL',
    'IQPGGGGPRL',   // chevron
    'IQPGPPGPRL',
    'IQPPPPPPRL',
    'IQPPPPPPRL',
    'IQPPPPPPRL',
    'MLRRRRRRLM',   // belt
    '.IPPPPPPI.',   // skirt of the tabard
    '.IPPPPPPI.',
    '.MLLLLLLM.',
  ], K);
}

/** Pauldrons sit proud of the torso, which is what gives the silhouette width. */
function pauldrons(px, x, y) {
  const K = { H: STEEL.hi, I: STEEL.base, M: STEEL.mid, L: STEEL.low };
  px.stamp(x - 3, y, ['HHII', 'HIIM', 'MIML', '.LL.'], K);
  px.stamp(x + 9, y, ['IIMM', 'IIML', 'MMLL', '.LL.'], K);
}

/** Legs with greaves and sabatons. `stride` shifts weight between them. */
function legs(px, x, y, stride) {
  const L = STEEL.low, M = STEEL.mid, B = STEEL.base;
  // near leg
  px.rect(x + 1, y, 3, 7 - stride, M);
  px.rect(x + 1, y, 1, 7 - stride, B);
  px.rect(x, y + 7 - stride, 5, 2, L);
  // far leg, one value darker so the legs separate
  px.rect(x + 6, y, 3, 7 + stride, L);
  px.rect(x + 6, y, 1, 7 + stride, M);
  px.rect(x + 5, y + 7 + stride, 5, 2, STEEL.dark);
}

/** Heraldic kite shield with a steel rim, so it never merges with the tabard. */
function shield(px, x, y, house) {
  const K = { E: STEEL.hi, F: STEEL.mid, P: house.base, Q: house.hi, R: house.low, G: house.charge };
  px.stamp(x, y, [
    'EEEEEEEEE',
    'EQPPPPPQE',
    'EPPGGGPPE',
    'EPGGGGGPE',
    'EPPGGGPPE',
    'EPPPGPPPE',
    'EPPPPPPPE',
    'FPPPPPPPF',
    'FRPPPPPRF',
    '.FRPPPRF.',
    '.FRPPPRF.',
    '..FRPRF..',
    '...FRF...',
    '....F....',
  ], K);
}

/**
 * Sword along an angle from the fist, so one parameter sweeps the whole swing
 * and every frame stays on the same pixel grid.
 */
function sword(px, fx, fy, angleDeg, len) {
  const a = (angleDeg * Math.PI) / 180;
  const nx = Math.sin(a);           // unit normal, for the lit edge and guard
  const ny = -Math.cos(a);
  const tx = fx + Math.cos(a) * len;
  const ty = fy + Math.sin(a) * len;
  px.line(fx, fy, tx, ty, STEEL.mid);                               // spine
  px.line(fx + nx, fy + ny, tx + nx, ty + ny, STEEL.hi);            // lit edge
  px.line(fx - nx, fy - ny, tx - nx * 0.4, ty - ny * 0.4, STEEL.low); // shaded edge
  px.line(fx - nx * 2.5, fy - ny * 2.5, fx + nx * 2.5, fy + ny * 2.5, GOLD.base); // crossguard
  px.set(fx - Math.cos(a) * 2, fy - Math.sin(a) * 2, GOLD.hi);      // pommel
}

/** The arm that carries the shield, bridging body to boss. */
function shieldArm(px, x, y) {
  px.rect(x, y, 5, 3, STEEL.low);
  px.rect(x, y, 5, 1, STEEL.mid);
}

/** Sword arm: darkest steel, so it reads against the tabard behind it. */
function arm(px, sx, sy, fx, fy) {
  px.line(sx, sy, fx, fy, STEEL.low, 2);
  px.line(sx, sy, fx, fy, STEEL.mid);
  px.rect(fx - 1, fy - 1, 3, 3, SKIN.base);
  px.set(fx - 1, fy - 1, SKIN.hi);
}

// ------------------------------------------------------------------ poses

const BODY_X = 15;   // torso left edge
const SHIELD_X = 7;  // overlaps the body by ~3px: held, not floating beside him

/** One frame. `pose` carries everything the animations vary. */
export function knightFrame(house, pose) {
  const p = new Px(W, H);
  const bob = pose.bob ?? 0;
  const lean = pose.lean ?? 0;

  const headY = 6 + bob;
  const torsoY = 16 + bob;
  const legY = 29;

  // sword arm pivots at the far shoulder
  const angle = pose.sword ?? -55;
  const sx = BODY_X + 9 + lean;
  const sy = torsoY + 3;
  const a = (angle * Math.PI) / 180;
  const fx = Math.round(sx + Math.cos(a) * 6);
  const fy = Math.round(sy + Math.sin(a) * 6);
  const swing = () => {
    arm(p, sx, sy, fx, fy);
    sword(p, fx, fy, angle, pose.reach ?? 14);
  };

  legs(p, BODY_X, legY, pose.stride ?? 0);
  // a blade swung back past vertical passes behind the head, not through it
  if (angle < -95) swing();
  torso(p, BODY_X + lean, torsoY, house);
  pauldrons(p, BODY_X + lean, torsoY + 1);
  helm(p, BODY_X + lean, headY, house);
  if (angle >= -95) swing();

  // shield arm in front of the body
  const shX = SHIELD_X + lean + (pose.guard ?? 0);
  shieldArm(p, shX + 7, torsoY + 6);
  shield(p, shX, torsoY + 2, house);

  p.outline(DARK);
  return p;
}

// ------------------------------------------------------------- animations

/** Frame lists; timing ships with the sprite so the UI only needs a frame rate. */
export const ANIMS = {
  idle: [
    { bob: 0, sword: -52 },
    { bob: 0, sword: -55 },
    { bob: 1, sword: -58, stride: 0 },
    { bob: 0, sword: -55 },
  ],
  strike: [
    { bob: 0, sword: -125, lean: -1, reach: 14 },                 // windup
    { bob: 0, sword: -85, lean: 0, reach: 14 },
    { bob: 1, sword: -10, lean: 2, reach: 15, guard: -2 },        // the blow
    { bob: 1, sword: 20, lean: 2, reach: 15, guard: -2 },
    { bob: 0, sword: -40, lean: 0, reach: 14 },                   // recover
  ],
  hurt: [
    { bob: 1, sword: -15, lean: -2, guard: 3 },
    { bob: 2, sword: 5, lean: -4, guard: 4 },
    { bob: 1, sword: -25, lean: -2, guard: 2 },
  ],
  cheer: [
    { bob: 0, sword: -72, reach: 15 },
    { bob: -1, sword: -68, reach: 16 },
    { bob: -2, sword: -64, reach: 17 },
    { bob: -1, sword: -68, reach: 16 },
  ],
};

export { W, H };
