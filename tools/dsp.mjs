/**
 * A small offline synthesiser for the game's music and ambience.
 *
 * Everything renders into stereo Float32Arrays at 48 kHz and is driven by a
 * seeded PRNG, so a rebuild is identical at the PCM level (verify-assets hashes
 * the decoded audio). No samples, no sample packs, nothing downloaded.
 *
 * Two constraints shape every voice here:
 *  - Phone speakers barely reproduce anything under ~150 Hz. A pure 50 Hz drum
 *    is silence on a phone. So every low voice carries harmonics and a
 *    mid-range attack the ear uses to infer the fundamental.
 *  - Loops must be seamless. render() overlaps the tail back onto the start
 *    with an equal-power crossfade, so reverb and decays wrap around the seam.
 */
import fs from 'node:fs';

export const SR = 48000;

// ------------------------------------------------------------------ basics

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

export const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const cents = (c) => Math.pow(2, c / 1200);

export function stereo(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}

/** Equal-power pan: -1 left .. 1 right. */
export function panGains(pan) {
  const a = ((pan + 1) / 2) * (Math.PI / 2);
  return [Math.cos(a), Math.sin(a)];
}

/** Mix a mono buffer into a stereo bus at a sample offset, gain and pan. */
export function mix(bus, mono, at, gain = 1, pan = 0) {
  const [gl, gr] = panGains(pan);
  const end = Math.min(mono.length, bus.n - at);
  for (let i = Math.max(0, -at); i < end; i++) {
    const v = mono[i] * gain;
    bus.L[at + i] += v * gl;
    bus.R[at + i] += v * gr;
  }
}

// ------------------------------------------------------------- oscillators

/** PolyBLEP: removes the aliasing a naive saw/square produces at high pitch. */
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

/** Band-limited sawtooth with an optional per-sample frequency function. */
export function saw(seconds, freq) {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'function' ? freq(i / SR) : freq;
    const dt = f / SR;
    out[i] = 2 * ph - 1 - blep(ph, dt);
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

export function sine(seconds, freq, phase = 0) {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'function' ? freq(i / SR) : freq;
    out[i] = Math.sin(2 * Math.PI * ph);
    ph += f / SR;
  }
  return out;
}

export function whiteNoise(seconds, r) {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r();
  return out;
}

/** Pink-ish noise (Paul Kellet's economy filter): natural for crowds and wind. */
export function pinkNoise(seconds, r) {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return out;
}

// ----------------------------------------------------------------- filters

/**
 * RBJ cookbook biquad. `cutoff` may be a function of time for sweeps.
 * Types: lowpass, highpass, bandpass (constant 0 dB peak).
 */
export function biquad(input, type, cutoff, q = 0.707) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, lastF = -1;
  for (let i = 0; i < input.length; i++) {
    const f = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    if (f !== lastF) {
      const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
      const cw = Math.cos(w), alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
      else if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
      else { b0 = alpha; b1 = 0; b2 = -alpha; }
      a1 = -2 * cw; a2 = 1 - alpha;
      b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
      lastF = f;
    }
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Attack / decay / sustain / release, in seconds, over a note of `dur`. */
export function adsr(buf, a, d, s, r, dur) {
  const n = buf.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e;
    if (t < a) e = t / a;
    else if (t < a + d) e = 1 - (1 - s) * ((t - a) / d);
    else if (t < dur) e = s;
    else e = s * Math.max(0, 1 - (t - dur) / r);
    buf[i] *= e;
  }
  return buf;
}

export function expDecay(buf, rate) {
  for (let i = 0; i < buf.length; i++) buf[i] *= Math.exp(-rate * i / SR);
  return buf;
}

/** tanh saturation: adds the harmonics small speakers need to imply the bass. */
export function drive(buf, amount) {
  const k = Math.tanh(amount);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * amount) / k;
  return buf;
}

export function add(a, b, gb = 1) {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < a.length; i++) out[i] = a[i];
  for (let i = 0; i < b.length; i++) out[i] += b[i] * gb;
  return out;
}

// ------------------------------------------------------------------ reverb

/**
 * Freeverb-style stereo reverb: 8 lowpass-feedback combs and 4 allpasses per
 * channel, the right channel's delays offset so the image is wide. Returns the
 * wet signal only; the caller mixes it.
 */
export function reverb(bus, { room = 0.84, damp = 0.25, width = 1, predelay = 0.02 } = {}) {
  const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const APS = [556, 441, 341, 225];
  const scale = SR / 44100;
  const pre = Math.round(predelay * SR);
  const run = (input, spread) => {
    const out = new Float32Array(input.length);
    const combs = COMBS.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, lp: 0 }));
    const aps = APS.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }));
    for (let n = 0; n < input.length; n++) {
      const x = (n >= pre ? input[n - pre] : 0) * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.lp = o * (1 - damp) + c.lp * damp;
        c.buf[c.i] = x + c.lp * room;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of aps) {
        const o = a.buf[a.i];
        a.buf[a.i] = y + o * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = o - y;
      }
      out[n] = y;
    }
    return out;
  };
  const mono = new Float32Array(bus.n);
  for (let i = 0; i < bus.n; i++) mono[i] = (bus.L[i] + bus.R[i]) * 0.5;
  const wl = run(mono, 0), wr = run(mono, 23);
  // width: 1 = fully decorrelated, 0 = mono
  const L = new Float32Array(bus.n), R = new Float32Array(bus.n);
  for (let i = 0; i < bus.n; i++) {
    L[i] = wl[i] * (0.5 + width / 2) + wr[i] * (0.5 - width / 2);
    R[i] = wr[i] * (0.5 + width / 2) + wl[i] * (0.5 - width / 2);
  }
  return { L, R, n: bus.n };
}

export function sumInto(dst, src, gain = 1) {
  for (let i = 0; i < dst.n; i++) { dst.L[i] += src.L[i] * gain; dst.R[i] += src.R[i] * gain; }
}

// ------------------------------------------------------------- mastering

/**
 * Glue: a gentle RMS compressor, then soft clip, then normalise to `peak`.
 * The music sits under the sound effects, never on top of them.
 */
export function master(bus, { threshold = 0.35, ratio = 3, peak = 0.85 } = {}) {
  let env = 0;
  const att = Math.exp(-1 / (0.01 * SR)), rel = Math.exp(-1 / (0.18 * SR));
  for (let i = 0; i < bus.n; i++) {
    const x = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i]));
    env = x > env ? att * env + (1 - att) * x : rel * env + (1 - rel) * x;
    let g = 1;
    if (env > threshold) g = (threshold + (env - threshold) / ratio) / env;
    bus.L[i] = Math.tanh(bus.L[i] * g * 1.2);
    bus.R[i] = Math.tanh(bus.R[i] * g * 1.2);
  }
  let p = 0;
  for (let i = 0; i < bus.n; i++) p = Math.max(p, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  if (p > 0) for (let i = 0; i < bus.n; i++) { bus.L[i] *= peak / p; bus.R[i] *= peak / p; }
  return bus;
}

/**
 * Fold the tail (everything past `loopN` samples) back over the start with an
 * equal-power crossfade, then cut to exactly `loopN`. The seam then carries the
 * reverb and decays that would otherwise be lost - a loop with no hiccup.
 */
export function seamless(bus, loopN, fadeSeconds) {
  const F = Math.min(Math.round(fadeSeconds * SR), bus.n - loopN);
  const L = bus.L.slice(0, loopN), R = bus.R.slice(0, loopN);
  for (let i = 0; i < F; i++) {
    const t = i / F;
    const gIn = Math.sin(t * Math.PI / 2), gOut = Math.cos(t * Math.PI / 2);
    // start of the loop fades in while the overflowing tail fades out over it
    L[i] = L[i] * gIn + bus.L[loopN + i] * gOut;
    R[i] = R[i] * gIn + bus.R[loopN + i] * gOut;
  }
  return { L, R, n: loopN };
}

// --------------------------------------------------------------- encoding

/** 16-bit stereo WAV, for handing to the Opus encoder. */
export function wavStereo(bus) {
  const n = bus.n;
  const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.L[i])) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.R[i])) * 32767), 46 + i * 4);
  }
  return b;
}

export function writeWav(file, bus) {
  fs.writeFileSync(file, wavStereo(bus));
}
