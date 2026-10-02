#!/usr/bin/env node
/**
 * Generates every audio and icon asset from source. Nothing binary is committed:
 * the audited app shipped 12 "images" that were actually S3 "Access Denied" XML
 * error pages, because assets were downloaded by hand and never verified.
 *
 * Audio: synthesised with plain maths, encoded to Opus via ffmpeg-static.
 * Icons: hand-authored SVG, rasterised with @resvg/resvg-js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SFX_DIR = 'public/sfx';
const ICON_DIR = 'public/icons';
const RES_DIR = 'resources'; // native launcher/store art - not served to the web
const SR = 48000;

// ---------------------------------------------------------------- audio ----
function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Deterministic PRNG so a rebuild produces byte-identical audio. */
function noise(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

function render(durationS, fn) {
  const n = Math.floor(SR * durationS);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.9;
  return out;
}

const SOUNDS = {
  // short metallic strike for each keypress
  hit: () => { const r = noise(7); return render(0.09, (t) =>
    0.6 * r() * Math.exp(-t * 60) + 0.4 * Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 55)); },
  // rising two-note fanfare for an accepted word
  correct: () => render(0.34, (t) => {
    const a = Math.sin(2 * Math.PI * 587.33 * t) * Math.exp(-t * 7);
    const b = t > 0.11 ? Math.sin(2 * Math.PI * 880 * (t - 0.11)) * Math.exp(-(t - 0.11) * 7) : 0;
    return 0.5 * a + 0.5 * b;
  }),
  // dull downward thud for a rejection
  wrong: () => render(0.26, (t) =>
    Math.sin(2 * Math.PI * (196 - 70 * t / 0.26) * t) * Math.exp(-t * 11)),
  // urgent pulse when time runs low
  warning: () => render(0.22, (t) =>
    Math.sin(2 * Math.PI * 1046.5 * t) * Math.exp(-t * 14) * (t < 0.1 || t > 0.12 ? 1 : 0.2)),
  // horn call at the start of a round
  charge: () => render(0.7, (t) => {
    const f = t < 0.2 ? 392 : t < 0.4 ? 523.25 : 659.25;
    const env = Math.min(1, t * 22) * Math.exp(-Math.max(0, t - 0.45) * 9);
    return (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * env;
  }),
};

function buildAudio() {
  const ffmpeg = require('ffmpeg-static');
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    throw new Error('ffmpeg-static binary missing - run: npm approve-scripts ffmpeg-static');
  }
  fs.mkdirSync(SFX_DIR, { recursive: true });
  let total = 0;
  for (const [name, make] of Object.entries(SOUNDS)) {
    const tmp = path.join(SFX_DIR, `${name}.wav`);
    const out = path.join(SFX_DIR, `${name}.opus`);
    fs.writeFileSync(tmp, wav(make()));
    // -serial_offset pins the Ogg bitstream serial, which ffmpeg otherwise
    // randomises per run. Without it the audio is identical but the bytes are
    // not, and the reproducibility check in CI fails for no real reason.
    execFileSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', tmp, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-application', 'audio',
      '-serial_offset', String(1 + Object.keys(SOUNDS).indexOf(name)),
      '-map_metadata', '-1', out,
    ]);
    fs.unlinkSync(tmp);
    const size = fs.statSync(out).size;
    total += size;
    console.log(`  sfx  ${name.padEnd(8)} ${String(size).padStart(6)} bytes`);
  }
  console.log(`  sfx  ${'TOTAL'.padEnd(8)} ${String(total).padStart(6)} bytes`);
  return total;
}

// ---------------------------------------------------------------- icons ----
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b2510"/><stop offset="100%" stop-color="#150d05"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8d49a"/><stop offset="100%" stop-color="#a8863f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M256 74 L404 126 V266 C404 350 336 408 256 438 C176 408 108 350 108 266 V126 Z"
        fill="none" stroke="url(#gold)" stroke-width="18"/>
  <path d="M150 300 L256 148 L362 300 Z" fill="url(#gold)" opacity="0.18"/>
  <g stroke="url(#gold)" stroke-width="20" stroke-linecap="round">
    <line x1="176" y1="336" x2="336" y2="176"/>
    <line x1="336" y1="336" x2="176" y2="176"/>
  </g>
  <circle cx="256" cy="256" r="30" fill="url(#gold)"/>
  <text x="256" y="272" font-family="Georgia,serif" font-size="42" font-weight="700"
        text-anchor="middle" fill="#150d05">W</text>
</svg>`;

function buildIcons() {
  const { Resvg } = require('@resvg/resvg-js');
  fs.mkdirSync(ICON_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICON_DIR, 'favicon.svg'), ICON_SVG);
  fs.mkdirSync(RES_DIR, { recursive: true });
  // served with the web bundle
  const web = { 'favicon-32.png': 32, 'apple-touch-icon.png': 180 };
  // consumed by the native build / store listing, never served
  const native = { 'icon.png': 1024, 'icon-foreground.png': 432, 'splash.png': 2732 };

  let total = fs.statSync(path.join(ICON_DIR, 'favicon.svg')).size;
  const emit = (dir, file, size) => {
    const png = new Resvg(ICON_SVG, { fitTo: { mode: 'width', value: size } }).render().asPng();
    fs.writeFileSync(path.join(dir, file), png);
    total += png.length;
    console.log(`  icon ${path.join(dir, file).padEnd(30)} ${String(png.length).padStart(7)} bytes (${size}px)`);
  };
  for (const [f, s] of Object.entries(web)) emit(ICON_DIR, f, s);
  for (const [f, s] of Object.entries(native)) emit(RES_DIR, f, s);
  fs.writeFileSync(path.join(RES_DIR, 'icon.svg'), ICON_SVG);
  return total;
}

console.log('building assets');
const audioBytes = buildAudio();
const iconBytes = buildIcons();
console.log(`  ---`);
console.log(`  audio ${(audioBytes / 1024).toFixed(1)} KB, icons ${(iconBytes / 1024).toFixed(1)} KB`);
