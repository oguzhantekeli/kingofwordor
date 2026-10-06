/**
 * All game audio on one Web Audio context.
 *
 *  - SFX: decoded buffers, a fresh source per play, so overlapping sounds never
 *    cut each other off (an HTMLAudioElement cannot overlap itself).
 *  - Loops (the battle theme and the battlefield ambience): decoded buffers with
 *    `loop = true`. Measured in Chromium: an <audio loop> left 6.5 ms and 24 ms
 *    of silence at the seam; a looping AudioBufferSourceNode left 0 ms.
 *  - The context is suspended while the app is hidden and resumed on return,
 *    so nothing plays from the background.
 */
export type SoundName = 'hit' | 'correct' | 'wrong' | 'warning' | 'charge';
export type LoopName = 'theme' | 'ambience';

const BASE = import.meta.env.BASE_URL;
const SFX: Record<SoundName, string> = {
  hit: `${BASE}sfx/hit.opus`,
  correct: `${BASE}sfx/correct.opus`,
  wrong: `${BASE}sfx/wrong.opus`,
  warning: `${BASE}sfx/warning.opus`,
  charge: `${BASE}sfx/charge.opus`,
};
const LOOPS: Record<LoopName, { url: string; volume: number }> = {
  // The theme masters ~9 dB hotter than the old one (RMS -15 vs -24 dBFS), so
  // its gain is lower; it still sits ~6 dB more present than before, under the SFX.
  theme: { url: `${BASE}music/theme.opus`, volume: 0.26 },
  ambience: { url: `${BASE}music/ambience.opus`, volume: 0.24 },
};

/**
 * The music opens up as the battle heats up: a low-pass from 6 kHz at calm to
 * fully open at a full streak, plus a small lift in level. The floor stays high
 * on purpose - the complaint was that the music was boring, so it must never
 * sound muffled at rest.
 */
export function musicCutoff(intensity: number): number {
  const v = Math.max(0, Math.min(1, intensity));
  return 6000 * Math.pow(20000 / 6000, v);
}
export function musicLift(intensity: number): number {
  const v = Math.max(0, Math.min(1, intensity));
  return 0.85 + 0.15 * v;
}

interface Running { src: AudioBufferSourceNode; gain: GainNode }

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicBus: GainNode | null = null;
  private readonly sfx = new Map<SoundName, AudioBuffer>();
  private readonly loopBufs = new Map<LoopName, Promise<AudioBuffer | null>>();
  private readonly running = new Map<LoopName, Running>();
  private readonly wanted = new Set<LoopName>();
  private sfxOn = true;
  private musicOn = true;
  private intensity = 0.3;

  get unlocked(): boolean { return this.ctx !== null; }

  /** Must be called from a user gesture; browsers block audio before one. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.35;
    this.sfxGain.connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = musicCutoff(this.intensity);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = musicLift(this.intensity);
    this.musicFilter.connect(this.musicBus).connect(ctx.destination);
    // nothing plays from the background
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** Decode everything. Called right after unlock; the countdown hides the cost. */
  async preload(fetchImpl = fetch): Promise<void> {
    if (!this.ctx) return;
    const decode = async (url: string) => {
      try {
        const res = await fetchImpl(url);
        if (!res.ok) return null;
        return await this.ctx!.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null; // a missing sound must never break the game
      }
    };
    for (const name of Object.keys(LOOPS) as LoopName[]) {
      if (!this.loopBufs.has(name)) this.loopBufs.set(name, decode(LOOPS[name].url));
    }
    await Promise.all((Object.keys(SFX) as SoundName[]).map(async (n) => {
      if (this.sfx.has(n)) return;
      const b = await decode(SFX[n]);
      if (b) this.sfx.set(n, b);
    }));
  }

  setEnabled(v: boolean): void { this.sfxOn = v; }

  setMusicEnabled(v: boolean): void {
    this.musicOn = v;
    // deleting the current entry while iterating a Map is safe per the spec
    if (!v) for (const n of this.running.keys()) this.halt(n, 0.3);
    else for (const n of this.wanted) void this.startLoop(n);
  }

  /** Fire-and-forget. Overlapping calls each get their own source node. */
  play(name: SoundName): void {
    if (!this.sfxOn || !this.ctx || !this.sfxGain) return;
    const buffer = this.sfx.get(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.sfxGain);
    src.start(0);
  }

  /** Start a loop with a short fade. Safe to call before its buffer is decoded. */
  async startLoop(name: LoopName, fade = 1.2): Promise<void> {
    this.wanted.add(name);
    if (!this.musicOn || !this.ctx || this.running.has(name)) return;
    if (!this.loopBufs.has(name)) void this.preload();
    const buf = await this.loopBufs.get(name);
    // the screen may have changed while it was decoding
    if (!buf || !this.ctx || !this.wanted.has(name) || this.running.has(name) || !this.musicOn) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(LOOPS[name].volume, now + fade);
    // the theme runs through the intensity filter; the ambience goes direct
    src.connect(gain).connect(name === 'theme' ? this.musicFilter! : this.ctx.destination);
    src.start(now);
    this.running.set(name, { src, gain });
  }

  stopLoop(name: LoopName, fade = 0.8): void {
    this.wanted.delete(name);
    this.halt(name, fade);
  }

  private halt(name: LoopName, fade: number): void {
    const r = this.running.get(name);
    if (!r || !this.ctx) return;
    const now = this.ctx.currentTime;
    r.gain.gain.cancelScheduledValues(now);
    r.gain.gain.setValueAtTime(r.gain.gain.value, now);
    r.gain.gain.linearRampToValueAtTime(0, now + fade);
    r.src.stop(now + fade + 0.05);
    this.running.delete(name);
  }

  /** 0..1 - driven by the scoring streak, alongside the battlefield. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
    if (!this.ctx || !this.musicFilter || !this.musicBus) return;
    const now = this.ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(musicCutoff(this.intensity), now, 0.4);
    this.musicBus.gain.setTargetAtTime(musicLift(this.intensity), now, 0.4);
  }
}

export const audio = new AudioEngine();
