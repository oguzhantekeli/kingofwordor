/**
 * Draws a Scene. Reads state, never mutates it.
 *
 * Everything is drawn into a low-resolution canvas on the pixel grid and the
 * browser scales it up with `image-rendering: pixelated`, so a 180-px-wide
 * field costs ~70k pixels a frame regardless of the phone's real resolution.
 */
import type { Duel, Fighter, Scene } from './scene';
import { groundOf } from './scene';
import { FIRE, SOLDIER, SOLDIER_ANIMS } from '../sprites.generated';

export interface Sheets {
  realm: CanvasImageSource;
  horde: CanvasImageSource;
  /** Pre-darkened copies for the far rank (atmospheric depth). */
  realmFar: CanvasImageSource;
  hordeFar: CanvasImageSource;
  fire: CanvasImageSource;
}

// Sky as hard bands, not a gradient: smooth gradients read as "not pixel art".
const SKY = [
  '#120a1c', '#170d23', '#1d102a', '#241330', '#2d1634', '#381935',
  '#461c34', '#561f31', '#68232d', '#7b2a28', '#8e3424', '#a24221',
];

/**
 * Everything that does not move is drawn ONCE into offscreen layers and blitted
 * each frame. Measured before this cache at 4x CPU throttle: draw p50 1.3 ms but
 * p95 25 ms / max 42 ms, from thousands of 1-px fillRect calls redrawing a sky
 * that never changes. The layers are keyed on size + ground line and rebuilt
 * only when those change.
 */
interface Layers { w: number; h: number; g: number; sky: HTMLCanvasElement; far: HTMLCanvasElement; near: HTMLCanvasElement }
/**
 * One cache per target canvas. A single module-level cache made two mounted
 * battlefields evict each other on every frame - measured as a 58 ms spike.
 */
const caches = new WeakMap<CanvasRenderingContext2D, Layers>();
const PAD = 8; // ridge layers are wider than the screen so they can drift

function offscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function buildLayers(w: number, h: number, groundY: number): Layers {
  const horizon = groundY - 26;
  const [sky, gs] = offscreen(w, h);
  // sky, banded, glowing red toward the horizon where the keep burns
  const band = Math.max(1, Math.ceil(horizon / SKY.length));
  SKY.forEach((c, i) => { gs.fillStyle = c; gs.fillRect(0, i * band, w, band + 1); });
  // dither seam between bands: a checker row, the pixel-art gradient
  for (let i = 1; i < SKY.length; i++) {
    gs.fillStyle = SKY[i]!;
    const y = i * band - 1;
    for (let x = i % 2; x < w; x += 2) gs.fillRect(x, y, 1, 1);
  }
  // Rising behind the hills, not a fraction of the sky's height: on a real phone
  // the fraction put it behind the title. Tied to the horizon, it stays in the
  // hero's stage. Measured clear of the subtitle at 1.0x, 1.3x and 2x system
  // font size; horizon - 22 was not (the wall's padding and the halo add ~20 px).
  moon(gs, Math.round(w * 0.16), horizon - 14, Math.max(6, Math.round(w * 0.045)));
  // ground and scorched patches
  gs.fillStyle = '#1e1310';
  gs.fillRect(0, horizon + 10, w, h - horizon - 10);
  gs.fillStyle = '#2a1a12';
  gs.fillRect(0, groundY, w, 2);
  gs.fillStyle = '#160e0b';
  for (let i = 0; i < 9; i++) gs.fillRect((i * 41 + 7) % w, groundY + 3 + (i % 3) * 2, 6 + (i % 4) * 3, 1);

  const [far, gf] = offscreen(w + PAD * 2, h);
  ridge(gf, w + PAD * 2, horizon - 6, 14, '#2a1530', 0.11, 3);

  const [near, gn] = offscreen(w + PAD * 2, h);
  keep(gn, Math.round(w * 0.58) + PAD, horizon - 10);
  ridge(gn, w + PAD * 2, horizon + 4, 10, '#22101e', 0.19, 41);

  return { w, h, g: groundY, sky, far, near };
}

export function draw(ctx: CanvasRenderingContext2D, scene: Scene, sheets: Sheets | null): void {
  const { w, h, groundY } = scene;
  ctx.imageSmoothingEnabled = false;
  const horizon = groundY - 26;

  // compare numbers: a template-string key allocated a string every frame
  let layers = caches.get(ctx);
  if (!layers || layers.w !== w || layers.h !== h || layers.g !== groundY) {
    layers = buildLayers(w, h, groundY);
    caches.set(ctx, layers);
  }

  ctx.drawImage(layers.sky, 0, 0);

  // stars twinkle, so they stay per-frame - 22 rects is nothing
  ctx.fillStyle = '#e8d9b8';
  for (let i = 0; i < 22; i++) {
    const x = (i * 73 + 11) % w;
    const y = (i * 37 + 5) % Math.max(8, Math.floor(horizon * 0.45));
    if ((i + Math.floor(scene.time * 2)) % 9 !== 0) ctx.fillRect(x, y, 1, 1);
  }

  // smoke wisps drifting across the sky
  for (let i = 0; i < 4; i++) {
    const span = w + 60;
    const x = ((i * 67 + scene.time * (2 + i * 0.7)) % span) - 40;
    wisp(ctx, Math.round(x), Math.round(horizon * (0.18 + i * 0.13)), 26 + i * 6, i % 2 ? '#2a1830' : '#33192f');
  }

  // ridges drift a few pixels for parallax: a blit with an offset, not a redraw
  const drift = Math.sin(scene.time * 0.05) * 3;
  ctx.drawImage(layers.far, Math.round(-PAD + drift), 0);
  ctx.drawImage(layers.near, Math.round(-PAD - drift * 0.5), 0);

  // ---- smoke and ash behind the soldiers
  const ps = scene.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (p.kind !== 'smoke' && p.kind !== 'ash') continue;
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = p.kind === 'smoke' ? 0.35 * k : 0.7 * k;
    ctx.fillStyle = p.kind === 'smoke' ? '#5a4a52' : '#9a8f86';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // ---- fires (castle fires are drawn above the keep, field fires on the line)
  if (sheets) {
    for (const f of scene.fires) {
      ctx.drawImage(sheets.fire, f.frame * FIRE.w, 0, FIRE.w, FIRE.h,
        f.x, f.y, FIRE.w, FIRE.h);
    }
  }

  // ---- soldiers: far rank first, then near
  if (sheets) {
    for (const d of scene.duels) if (d.far) duel(ctx, scene, d, sheets);
    for (const d of scene.duels) if (!d.far) duel(ctx, scene, d, sheets);
  }

  // ---- dust and embers in front
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (p.kind !== 'dust' && p.kind !== 'ember') continue;
    const k = 1 - p.life / p.max;
    if (p.kind === 'ember') {
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.fillStyle = k > 0.6 ? '#ffd45a' : k > 0.3 ? '#f59a2e' : '#d9541e';
    } else {
      ctx.globalAlpha = 0.75 * k;
      ctx.fillStyle = '#8a7258';
    }
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function duel(ctx: CanvasRenderingContext2D, scene: Scene, d: Duel, s: Sheets): void {
  const base = groundOf(scene, d) - SOLDIER.h + 1;
  fighter(ctx, d.realm, base, d.far ? s.realmFar : s.realm, false);
  fighter(ctx, d.horde, base, d.far ? s.hordeFar : s.horde, true);
}

function fighter(
  ctx: CanvasRenderingContext2D, f: Fighter, y: number, sheet: CanvasImageSource, flip: boolean
): void {
  const a = SOLDIER_ANIMS[f.anim];
  const sx = Math.min(f.frame, a.frames - 1) * SOLDIER.w;
  const sy = a.row * SOLDIER.h;
  const x = Math.round(f.x);
  ctx.globalAlpha = Math.max(0, Math.min(1, f.alpha));
  if (flip) {
    // The Horde faces left: mirror around the sprite's own centre.
    ctx.save();
    ctx.translate(x + SOLDIER.w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, SOLDIER.w, SOLDIER.h, 0, 0, SOLDIER.w, SOLDIER.h);
    ctx.restore();
  } else {
    ctx.drawImage(sheet, sx, sy, SOLDIER.w, SOLDIER.h, x, y, SOLDIER.w, SOLDIER.h);
  }
  ctx.globalAlpha = 1;
}

/** A pixel moon: hard-edged disc, a darker limb and two craters. */
function moon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // halo: one dithered ring
  ctx.fillStyle = 'rgba(214, 96, 64, 0.16)';
  for (let y = -r - 3; y <= r + 3; y++) {
    for (let x = -r - 3; x <= r + 3; x++) {
      const d = x * x + y * y;
      if (d > r * r && d <= (r + 3) * (r + 3) && (x + y) % 2 === 0) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > r * r) continue;
      // lit from the upper left; the far limb is a shade darker
      ctx.fillStyle = x + y > r * 0.5 ? '#c7553c' : '#e88a5a';
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  ctx.fillStyle = '#b84a34';
  ctx.fillRect(cx - Math.round(r * 0.3), cy - Math.round(r * 0.2), 2, 2);
  ctx.fillRect(cx + Math.round(r * 0.25), cy + Math.round(r * 0.3), 2, 1);
}

/** A flat smoke wisp: three overlapping bars. */
function wisp(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, len, 2);
  ctx.fillRect(x + 6, y - 1, len - 12, 1);
  ctx.fillRect(x + 3, y + 2, len - 8, 1);
}

/** A jagged ridge from a fixed integer hash: same silhouette every launch. */
function ridge(
  ctx: CanvasRenderingContext2D, w: number, base: number, amp: number,
  colour: string, freq: number, phase: number
): void {
  ctx.fillStyle = colour;
  for (let x = 0; x < w; x++) {
    const v = Math.sin((x + phase) * freq) * 0.6 + Math.sin((x + phase) * freq * 2.7) * 0.4;
    const top = Math.round(base - (v * 0.5 + 0.5) * amp);
    ctx.fillRect(x, top, 1, base - top + 40);
  }
}

/** The besieged keep: towers, crenellations, lit windows. */
function keep(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = '#140a10';
  ctx.fillRect(x, base - 22, 10, 22);       // main tower
  ctx.fillRect(x - 12, base - 14, 9, 14);   // west tower
  ctx.fillRect(x + 14, base - 16, 9, 16);   // east tower
  ctx.fillRect(x - 12, base - 8, 35, 8);    // curtain wall
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 1 + i * 3, base - 24, 2, 2);
  ctx.fillStyle = '#e07a2b';
  ctx.fillRect(x + 4, base - 16, 2, 2);
  ctx.fillRect(x - 9, base - 9, 1, 2);
  ctx.fillRect(x + 18, base - 10, 1, 2);
}
