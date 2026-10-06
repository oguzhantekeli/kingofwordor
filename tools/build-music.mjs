/**
 * The game's music: an epic battle theme and a battlefield ambience bed.
 *
 *   node tools/build-music.mjs
 *
 * Theme: 140 bpm, D minor, exactly 16 bars so the loop lands on the beat.
 * (The previous theme appended an extra second of tail, so its beat stumbled
 * at every loop seam.) Ambience: a seamless 24 s bed. Both are synthesised
 * from code by tools/dsp.mjs, seeded, and reproducible at the PCM level.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  SR, rng, hz, cents, stereo, mix, saw, sine, whiteNoise, pinkNoise,
  biquad, adsr, expDecay, drive, add, reverb, sumInto, master, seamless, writeWav,
} from './dsp.mjs';

const require = createRequire(import.meta.url);
const OUT = path.resolve('public/music');

// ================================================================ THE THEME

const BPM = 140;
const BEAT = 60 / BPM;
const STEP = BEAT / 4;            // sixteenth note
const BARS = 16;
const LOOP_S = BARS * 4 * BEAT;   // 27.43 s
const at = (bar, step) => Math.round((bar * 16 + step) * STEP * SR);

/**
 * i - VI - iv - V, then i - VI - III - VII - i - VI - iv - V. The major V (A)
 * pulls hard back to D minor, which is what makes the loop restart feel driven.
 */
const CHORDS = [
  'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A',
  'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A',
];
const ROOT = { Dm: 38, Bb: 34, Gm: 31, A: 33, F: 29, C: 36 }; // MIDI, bass octave
const TRIAD = {
  Dm: [62, 65, 69], Bb: [58, 62, 65], Gm: [55, 58, 62],
  A: [57, 61, 64], F: [53, 57, 60], C: [55, 60, 64],
};

/** War drum: deep body WITH a mid-range thump and click, so phones hear it. */
function warDrum(r, f0 = 62, gain = 1) {
  const dur = 0.9;
  const body = sine(dur, (t) => f0 * (1 + 1.4 * Math.exp(-t * 28)));
  expDecay(body, 9);
  const thump = sine(dur, (t) => f0 * 3.1 * (1 + 0.6 * Math.exp(-t * 40)));
  expDecay(thump, 16);
  const click = biquad(whiteNoise(0.03, r), 'bandpass', 2600, 1.2);
  expDecay(click, 120);
  // the thump carries more of the weight than the body: on a phone the body
  // is felt, not heard, and the first build had 75% of its energy under 150 Hz
  const out = add(add(body, thump, 1.0), click, 0.75);
  drive(out, 2.4);              // harmonics: the fundamental survives a phone speaker
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

function snare(r, gain = 1) {
  const n = biquad(whiteNoise(0.22, r), 'bandpass', 3200, 0.7);
  expDecay(n, 22);
  const body = expDecay(sine(0.22, 190), 30);
  const out = add(n, body, 0.5);
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

function cymbal(r, gain = 1) {
  const n = biquad(whiteNoise(2.6, r), 'highpass', 5200, 0.6);
  expDecay(n, 1.6);
  for (let i = 0; i < n.length; i++) n[i] *= gain;
  return n;
}

/** Spiccato low string: short, bright attack - the galloping ostinato. */
function spiccato(midi, gain) {
  const d = STEP * 0.9;
  const a = saw(d, hz(midi) * cents(-6)), b = saw(d, hz(midi) * cents(6));
  let s = add(a, b, 1);
  s = biquad(s, 'lowpass', (t) => 900 + 2200 * Math.exp(-t * 30), 0.9);
  adsr(s, 0.003, 0.05, 0.12, 0.025, d * 0.6);
  for (let i = 0; i < s.length; i++) s[i] *= gain;
  return s;
}

/** Brass: three detuned saws through a filter that swells on the attack. */
function brass(midi, dur, gain, swell = 1) {
  const len = dur + 0.25;
  let s = add(add(saw(len, hz(midi) * cents(-8)), saw(len, hz(midi))), saw(len, hz(midi) * cents(8)));
  s = add(s, saw(len, hz(midi) / 2), 0.4);
  s = biquad(s, 'lowpass', (t) => 500 + 2600 * swell * Math.min(1, t / 0.12) * Math.exp(-t * 0.9), 1.1);
  adsr(s, 0.035, 0.15, 0.75, 0.2, dur);
  drive(s, 1.4);
  for (let i = 0; i < s.length; i++) s[i] *= gain;
  return s;
}

/** Choir "ah": detuned saws through three vowel formants, slow attack. */
function choir(midi, dur, gain) {
  const len = dur + 0.6;
  let src = add(add(saw(len, hz(midi) * cents(-10)), saw(len, hz(midi) * cents(3))), saw(len, hz(midi) * cents(11)));
  const f1 = biquad(src, 'bandpass', 760, 6), f2 = biquad(src, 'bandpass', 1150, 7), f3 = biquad(src, 'bandpass', 2700, 8);
  let s = add(add(f1, f2, 0.7), f3, 0.35);
  adsr(s, 0.45, 0.3, 0.85, 0.5, dur);
  for (let i = 0; i < s.length; i++) s[i] *= gain;
  return s;
}

/**
 * Bass on the chord root, pulsing in eighths with the drums. Whole-bar
 * sustains were the source of a constant 300-450 Hz band in the first build
 * (visible on the spectrogram as a solid wall) that masked the brass.
 */
function bassLine(bus, r) {
  void r;
  for (let bar = 0; bar < BARS; bar++) {
    const m = ROOT[CHORDS[bar]] + 12;
    for (let e = 0; e < 8; e++) {
      const dur = BEAT * 0.42;
      let s = add(saw(dur, hz(m)), sine(dur, hz(m)), 0.6);
      s = biquad(s, 'lowpass', (t) => 260 + 900 * Math.exp(-t * 18), 0.9);
      adsr(s, 0.004, 0.08, 0.45, 0.04, dur * 0.8);
      drive(s, 1.6);
      mix(bus, s, at(bar, e * 2), e % 2 === 0 ? 0.2 : 0.13, 0);
    }
  }
}

/** The heroic horn line over bars 9-16: [midi, beats] per note. */
const MELODY = [
  [[62, 1], [69, 1], [74, 2]],
  [[72, 1], [70, 1], [65, 2]],
  [[69, 1], [72, 1], [77, 2]],
  [[76, 2], [72, 1], [67, 1]],
  [[74, 3], [77, 1]],
  [[74, 2], [70, 2]],
  [[67, 1], [70, 1], [74, 2]],
  [[73, 2], [76, 1], [69, 1]],
];

function theme() {
  const r = rng(0x77a12);
  const drums = stereo(LOOP_S + 4), music = stereo(LOOP_S + 4), pads = stereo(LOOP_S + 4);

  for (let bar = 0; bar < BARS; bar++) {
    const b = bar >= 8;                              // second half: full battle
    const chord = CHORDS[bar];

    // --- drums: a galloping pattern, denser in the second half
    const kick = b ? [0, 3, 6, 8, 10, 11, 14] : [0, 6, 8, 14];
    for (const s of kick) mix(drums, warDrum(r, 62, s === 0 ? 1 : 0.8), at(bar, s), 0.62, 0);
    for (const s of [4, 12]) mix(drums, warDrum(r, 96, 0.55), at(bar, s), 0.4, -0.35); // high drum
    if (b) for (const s of [4, 12]) mix(drums, snare(r, 0.9), at(bar, s), 0.34, 0.15);
    if (bar === 7 || bar === 15) {                   // roll into the next phrase
      for (let s = 8; s < 16; s++) mix(drums, snare(r, 0.4 + s * 0.04), at(bar, s), 0.3, 0.15);
    }
    if (bar === 0 || bar === 8) mix(drums, cymbal(r, 1), at(bar, 0), 0.26, 0.4);

    // --- ostinato: root/fifth/octave sixteenths with syncopated accents
    const root = ROOT[chord] + 12;
    const pattern = [0, 0, 7, 0, 12, 0, 7, 0, 0, 0, 7, 0, 12, 7, 0, 7];
    pattern.forEach((iv, s) => {
      const accent = [0, 3, 6, 8, 11, 14].includes(s) ? 1 : 0.6;
      mix(music, spiccato(root + iv, accent), at(bar, s), 0.15, -0.3);
    });

    // --- brass: power-chord stabs; sustained chords under the melody later
    const [p1, p2, p3] = TRIAD[chord];
    const stab = (step, dur) => {
      for (const m of [p1 - 12, p1, p1 + 7 - 12]) mix(music, brass(m, dur, 1), at(bar, step), 0.085, 0.3);
    };
    if (!b) { stab(0, BEAT * 0.9); if (bar % 2 === 1) stab(10, BEAT * 0.6); }
    else { for (const m of [p1 - 12, p2 - 12, p3 - 12]) mix(music, brass(m, 4 * BEAT * 0.95, 0.6, 0.55), at(bar, 0), 0.06, 0.25); }

    // --- choir pads in the second half
    if (b) for (const m of [p1, p2, p3]) mix(pads, choir(m - 12, 4 * BEAT, 1), at(bar, 0), 0.05, 0);
  }

  // --- the horn melody, bars 9-16
  MELODY.forEach((notes, i) => {
    let beat = 0;
    for (const [m, beats] of notes) {
      mix(music, brass(m, beats * BEAT * 0.96, 1.25, 1), at(8 + i, beat * 4), 0.12, 0.1);
      beat += beats;
    }
  });

  bassLine(music, r);

  // --- space: drums stay drier, brass and choir sit in a large hall
  const bus = stereo(LOOP_S + 4);
  sumInto(bus, drums, 1);
  sumInto(bus, music, 1);
  sumInto(bus, pads, 1);
  // Sends are high-passed before the reverb: a reverb fed the low-mids smears
  // them into a continuous drone. Standard mixing practice, and the cure for
  // the 300-450 Hz wall the first spectrogram showed.
  const hp = (a) => biquad(a, 'highpass', 320, 0.7);
  const hall = reverb({ L: hp(add(music.L, pads.L, 1.4)), R: hp(add(music.R, pads.R, 1.4)), n: bus.n }, { room: 0.86, damp: 0.3, predelay: 0.03 });
  const room = reverb({ L: hp(drums.L), R: hp(drums.R), n: bus.n }, { room: 0.7, damp: 0.45, predelay: 0.01 });
  sumInto(bus, hall, 0.55);
  sumInto(bus, room, 0.25);

  // nothing a speaker can play lives under ~40 Hz; it only costs headroom.
  // Two cascaded biquads = 24 dB/octave; one left too much at 20-35 Hz.
  for (const ch of ['L', 'R']) bus[ch] = biquad(biquad(bus[ch], 'highpass', 45, 0.7), 'highpass', 45, 0.7);
  // peak 0.8, not 0.86: Opus encoding overshot to -0.2 dBFS at 0.86
  master(bus, { threshold: 0.3, ratio: 3.2, peak: 0.8 });
  return seamless(bus, Math.round(LOOP_S * SR), 2.5);
}

// ============================================================ THE AMBIENCE

const AMB_S = 24;

/** A struck metal edge: inharmonic partials, fast decay - a distant clash. */
function clang(r, base) {
  const parts = [1, 2.32, 4.25, 6.63, 9.38];
  let out = new Float32Array(Math.ceil(0.45 * SR));
  parts.forEach((p, k) => {
    const s = expDecay(sine(0.45, base * p * (1 + r() * 0.01)), 9 + k * 6);
    for (let i = 0; i < s.length; i++) out[i] += s[i] * (1 / (k + 1));
  });
  const tick = expDecay(biquad(whiteNoise(0.02, r), 'highpass', 3500), 200);
  out = add(out, tick, 0.5);
  return out;
}

/** A war horn: a low saw through a closed filter, sliding up a fourth. */
function horn(seconds) {
  const f = (t) => hz(45) * (t < 0.5 ? 1 : t < 0.9 ? 1 + (t - 0.5) * 0.83 : 1.335);
  let s = add(saw(seconds, f), saw(seconds, (t) => f(t) * cents(9)), 0.8);
  s = biquad(s, 'lowpass', 850, 1.4);
  adsr(s, 0.25, 0.3, 0.8, 0.9, seconds - 0.9);
  return s;
}

function ambience() {
  const r = rng(0xa4b1e);
  const len = AMB_S + 4;
  const bus = stereo(len), near = stereo(len);

  // crowd bed: decorrelated pink noise per channel, shaped to the voice band,
  // swelling on slow, unrelated cycles so it never pulses in time
  for (const ch of ['L', 'R']) {
    let n = pinkNoise(len, r);
    n = biquad(biquad(n, 'highpass', 180, 0.7), 'lowpass', (t) => 900 + 350 * Math.sin(t * 0.37 + (ch === 'L' ? 0 : 1.7)), 0.8);
    for (let i = 0; i < n.length; i++) {
      const t = i / SR;
      const sw = 0.62 + 0.22 * Math.sin(t * 0.43) + 0.12 * Math.sin(t * 1.13 + 2) + 0.06 * Math.sin(t * 2.9);
      bus[ch][i] += n[i] * sw * 0.55;
    }
  }

  // distant clashes in small bursts, scattered across the stereo field
  let t = 0.3;
  while (t < AMB_S) {
    const burst = 1 + Math.floor((r() + 1) * 1.6);
    const pan = r() * 0.9;
    const dist = 0.35 + (r() + 1) * 0.3;
    for (let k = 0; k < burst; k++) {
      const s = biquad(clang(r, 1700 + (r() + 1) * 900), 'lowpass', 4200 - dist * 2200);
      mix(bus, s, Math.round((t + k * (0.11 + (r() + 1) * 0.05)) * SR), 0.16 * (1.1 - dist), pan);
    }
    t += 0.45 + (r() + 1) * 0.6;
  }

  // distant drums: a slow, heavy beat from beyond the hill
  for (let b = 0; b < AMB_S / 1.6; b++) {
    const s = biquad(warDrum(r, 46, 1), 'lowpass', 600);
    mix(bus, s, Math.round((0.8 + b * 1.6) * SR), 0.18, -0.5);
  }

  // one horn call per loop
  mix(bus, horn(3.4), Math.round(9.5 * SR), 0.1, 0.55);

  // fire close by: sparse crackles and the odd pop
  t = 0;
  while (t < AMB_S) {
    const pop = r() > 0.85;
    const s = expDecay(biquad(whiteNoise(pop ? 0.012 : 0.004, r), 'highpass', pop ? 900 : 2200), pop ? 260 : 700);
    mix(near, s, Math.round(t * SR), pop ? 0.22 : 0.09 * (0.5 + (r() + 1) * 0.5), r() * 0.6);
    t += 0.03 + Math.pow((r() + 1) / 2, 2) * 0.28;
  }

  // a big open space for everything far away; the fire stays close and dry
  const space = reverb(bus, { room: 0.88, damp: 0.35, predelay: 0.05, width: 1 });
  sumInto(bus, space, 0.65);
  sumInto(bus, near, 1);
  master(bus, { threshold: 0.4, ratio: 2.5, peak: 0.8 });
  return seamless(bus, AMB_S * SR, 3);
}

// =================================================================== encode

function encode(name, bus, kbps) {
  const ffmpeg = require('ffmpeg-static');
  const raw = path.join(OUT, `.${name}.wav`);
  writeWav(raw, bus);
  const file = path.join(OUT, `${name}.opus`);
  execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw,
    '-c:a', 'libopus', '-b:a', `${kbps}k`, '-vbr', 'on', '-application', 'audio', file]);
  fs.unlinkSync(raw);
  return fs.statSync(file).size;
}

fs.mkdirSync(OUT, { recursive: true });
console.log('building music');
const t0 = Date.now();
const th = theme();
console.log(`  theme.opus     ${String(encode('theme', th, 96)).padStart(7)} bytes  (${(th.n / SR).toFixed(2)} s = ${BARS} bars at ${BPM} bpm, ${th.n} samples)`);
const am = ambience();
console.log(`  ambience.opus  ${String(encode('ambience', am, 64)).padStart(7)} bytes  (${(am.n / SR).toFixed(2)} s, ${am.n} samples)`);
console.log(`  rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
