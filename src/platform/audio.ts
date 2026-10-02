/**
 * Web Audio with a decoded, pooled buffer.
 *
 * Deliberately NOT HTMLAudioElement: a single element cannot overlap with
 * itself, so `pause(); currentTime = 0; play()` truncates the previous sound.
 * That is exactly the bug in the audited app, and it fires on every keystroke.
 */
export type SoundName = 'hit' | 'correct' | 'wrong' | 'warning' | 'charge';

const FILES: Record<SoundName, string> = {
  hit: '/sfx/hit.opus',
  correct: '/sfx/correct.opus',
  wrong: '/sfx/wrong.opus',
  warning: '/sfx/warning.opus',
  charge: '/sfx/charge.opus',
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private gain: GainNode | null = null;
  private enabled = true;

  /** Must be called from a user gesture; browsers block audio before one. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.35;
    this.gain.connect(this.ctx.destination);
  }

  async preload(fetchImpl = fetch): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(
      (Object.keys(FILES) as SoundName[]).map(async (name) => {
        try {
          const res = await fetchImpl(FILES[name]);
          if (!res.ok) return;
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf);
        } catch {
          // A missing sound must never break the game.
        }
      })
    );
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  /** Fire-and-forget. Overlapping calls each get their own source node. */
  play(name: SoundName): void {
    if (!this.enabled || !this.ctx || !this.gain) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);
    src.start(0);
  }
}

export const audio = new AudioEngine();
