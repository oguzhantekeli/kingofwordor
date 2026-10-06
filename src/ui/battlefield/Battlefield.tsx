import { useEffect, useRef, type RefObject } from 'react';
import { createScene, nudge, setGround, setIntensity, step, type Scene } from './scene';
import { draw, type Sheets } from './render';
import { battle } from './bus';
import type { House } from '../sprites.generated';
import './battlefield.css';

interface Props {
  house: House;
  /** 0..1, where the battle line sits down the screen. */
  ground?: number;
  /** Starting intensity; the Play screen drives it live through the bus. */
  intensity?: number;
  /**
   * Put the battle line at this element's bottom edge - the hero's feet - so
   * the knight stands IN the battle on every screen size. A fixed fraction
   * cannot do that: the hero's position comes from flex layout.
   */
  anchor?: RefObject<HTMLElement | null>;
}

/** Render cadence. Pixel art animates at 8-15 fps; more only spends battery. */
const FPS = 15;
/** Target logical width in pixels; the real scale is an integer near this. */
const TARGET_W = 180;

/**
 * The battle behind the game: two hosts fighting under a burning keep, with
 * dust, embers, smoke and ash. Drawn on a low-resolution canvas and scaled by
 * whole integers, so every pixel lands on a pixel.
 *
 * - Pauses when the tab or app is hidden (no battery burned off-screen).
 * - prefers-reduced-motion: draws one still frame and never animates.
 * - Purely decorative: aria-hidden, pointer-events none.
 */
export function Battlefield({ house, ground = 0.36, intensity = 0.35, anchor }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let scene: Scene | null = null;
    let sheets: Sheets | null = null;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let alive = true;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const groundFraction = (rect: DOMRect): number => {
      const a = anchor?.current;
      if (!a || rect.height <= 0) return ground;
      const f = (a.getBoundingClientRect().bottom - rect.top) / rect.height;
      return Number.isFinite(f) ? Math.max(0.15, Math.min(0.85, f)) : ground;
    };

    const fit = () => {
      const rect = el.getBoundingClientRect();
      const scale = Math.max(1, Math.round(rect.width / TARGET_W));
      const w = Math.max(1, Math.ceil(rect.width / scale));
      const h = Math.max(1, Math.ceil(rect.height / scale));
      const g = groundFraction(rect);
      if (!scene || scene.w !== w || scene.h !== h) {
        cv.width = w;
        cv.height = h;
        cv.style.width = `${w * scale}px`;
        cv.style.height = `${h * scale}px`;
        scene = createScene({ w, h, ground: g, seed: 20261006, intensity: scene?.intensity ?? intensity });
      } else {
        setGround(scene, h * g); // same size: keep the battle, just move the line
      }
      draw(ctx, scene, sheets);
    };

    const frame = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden || !scene) { last = now; return; }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      acc += dt;
      if (acc < 1 / FPS) return;
      step(scene, acc);
      acc = 0;
      draw(ctx, scene, sheets);
    };

    void loadSheets(house).then((s) => {
      if (!alive) return;
      sheets = s;
      if (scene) draw(ctx, scene, sheets);
    });

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (anchor?.current) ro.observe(anchor.current);
    const off = battle.subscribe((e) => {
      if (!scene) return;
      if (e.type === 'win') nudge(scene, 'win');
      else if (e.type === 'loss') nudge(scene, 'loss');
      else setIntensity(scene, e.value);
      if (reduced) draw(ctx, scene, sheets);
    });
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  }, [house, ground, intensity, anchor]);

  return (
    <div ref={host} className="battlefield" aria-hidden="true">
      <canvas ref={canvas} className="battlefield-canvas" />
    </div>
  );
}

const cache = new Map<string, Promise<Sheets>>();

function loadSheets(house: House): Promise<Sheets> {
  const hit = cache.get(house);
  if (hit) return hit;
  const base = import.meta.env.BASE_URL;
  const p = Promise.all([
    img(`${base}sprites/realm-${house}.png`),
    img(`${base}sprites/horde.png`),
    img(`${base}sprites/fire.png`),
  ]).then(([realm, horde, fire]) => ({
    realm, horde, fire,
    realmFar: darken(realm), hordeFar: darken(horde),
  }));
  cache.set(house, p);
  return p;
}

function img(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`sprite failed: ${src}`));
    i.src = src;
  });
}

/**
 * Far-rank copy: the same pixels pushed toward the dusk colour. Done once at
 * load with source-atop, which works on every WebView - unlike ctx.filter,
 * which older Android System WebViews do not implement.
 */
function darken(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.naturalWidth;
  c.height = src.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return c;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(30, 14, 34, 0.55)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
