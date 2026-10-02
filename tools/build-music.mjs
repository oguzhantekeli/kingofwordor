/**
 * Generates the game's music. No library, no sample pack, no artist.
 *
 *   node tools/build-music.mjs
 *
 * A plucked string is Karplus-Strong: fill a delay line the length of one
 * period with noise, then play it back while averaging neighbours. That one
 * trick gives a lute far more convincingly than any additive stack, and it is
 * twenty lines. The drum is a pitch-dropping sine plus a noise transient.
 *
 * Everything is driven by a seeded PRNG, so a rebuild is byte-identical and
 * tools/verify-assets.mjs can hash the decoded PCM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SR = 48000;
const OUT = path.resolve('public/music');

// --------------------------------------------------------------- utilities

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

/** MIDI note -> Hz. A4 = 69 = 440. */
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ----------------------------------------------------------------- voices

/** Karplus-Strong pluck. `bright` keeps more high end; `damp` shortens it. */
function pluck(out, at, freq, gain, seconds, rnd, bright = 0.5, damp = 0.996) {
  const N = Math.max(2, Math.round(SR / freq));
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = rnd();
  // a one-pole low-pass on the excitation controls pick brightness
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += (buf[i] - lp) * bright; buf[i] = lp; }
  const n = Math.min(Math.floor(seconds * SR), out.length - at);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % N];
    buf[idx] = (cur + next) * 0.5 * damp;
    out[at + i] += cur * gain * Math.exp(-i / SR / seconds * 1.4);
    idx = (idx + 1) % N;
  }
}

/** Frame drum: a sine whose pitch collapses, plus a skin transient. */
function drum(out, at, freq, gain, seconds, rnd) {
  const n = Math.min(Math.floor(seconds * SR), out.length - at);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 - 0.55 * Math.min(1, t / 0.08));
    const env = Math.exp(-t * 11);
    const skin = rnd() * Math.exp(-t * 90) * 0.5;
    out[at + i] += (Math.sin(2 * Math.PI * f * t) + skin) * env * gain;
  }
}

/** A bowed drone, for the low fifth that holds the mode together. */
function drone(out, at, freq, gain, seconds) {
  const n = Math.min(Math.floor(seconds * SR), out.length - at);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 4.5 * t);
    const env = Math.min(1, t * 3) * Math.min(1, (seconds - t) * 3);
    out[at + i] +=
      (Math.sin(2 * Math.PI * freq * vib * t) * 0.6 +
       Math.sin(4 * Math.PI * freq * vib * t) * 0.25 +
       Math.sin(6 * Math.PI * freq * vib * t) * 0.1) * env * gain;
  }
}

// ---------------------------------------------------------------- the tune

const BPM = 92;
const BEAT = 60 / BPM;
const BARS = 8;

/**
 * D dorian — the medieval-sounding mode, and the reason this does not come out
 * as generic fantasy major. Degrees: D E F G A B C.
 */
const DORIAN = [62, 64, 65, 67, 69, 71, 72, 74];

/** Melody as scale degrees per bar; -1 is a rest. Written, not randomised. */
const MELODY = [
  [0, 2, 4, 2], [3, 2, 0, -1], [4, 5, 4, 2], [3, -1, 2, -1],
  [0, 2, 4, 7], [5, 4, 2, -1], [3, 2, 0, 2], [0, -1, -1, -1],
];

function theme() {
  const total = Math.ceil(BARS * 4 * BEAT * SR) + SR;
  const out = new Float32Array(total);
  const rnd = noise(0x4b4f57);

  for (let bar = 0; bar < BARS; bar++) {
    const barAt = Math.floor(bar * 4 * BEAT * SR);

    // drone: tonic for six bars, then the fourth, so the loop breathes
    drone(out, barAt, hz(bar < 6 ? 38 : 43), 0.1, 4 * BEAT);

    // frame drum: a heartbeat on 1 and 3, a lighter tap before the turnaround
    drum(out, barAt, 110, 0.5, 0.45, rnd);
    drum(out, barAt + Math.floor(2 * BEAT * SR), 98, 0.38, 0.4, rnd);
    if (bar % 4 === 3) drum(out, barAt + Math.floor(3.5 * BEAT * SR), 130, 0.3, 0.3, rnd);

    // lute: melody on the beat, with a lower drone string answering off-beat
    MELODY[bar].forEach((deg, i) => {
      const at = barAt + Math.floor(i * BEAT * SR);
      if (deg >= 0) pluck(out, at, hz(DORIAN[deg]), 0.5, BEAT * 1.6, rnd, 0.42);
      if (i % 2 === 1) pluck(out, at + Math.floor(BEAT * 0.5 * SR), hz(DORIAN[0] - 12), 0.22, BEAT, rnd, 0.3);
    });
  }

  // normalise with headroom; music sits under the SFX, never over them
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.72;
  return out;
}

// ----------------------------------------------------------------- encode

fs.mkdirSync(OUT, { recursive: true });
const ffmpeg = require('ffmpeg-static');
console.log('building music');

const samples = theme();
const raw = path.join(OUT, '.theme.wav');
fs.writeFileSync(raw, wav(samples));
const file = path.join(OUT, 'theme.opus');
execFileSync(ffmpeg, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', raw,
  '-c:a', 'libopus', '-b:a', '40k', '-vbr', 'on', '-application', 'audio',
  file,
]);
fs.unlinkSync(raw);

const bytes = fs.statSync(file).size;
console.log(`  theme.opus  ${String(bytes).padStart(7)} bytes  ` +
  `(${(samples.length / SR).toFixed(1)}s loop, ${BPM} bpm, D dorian)`);
