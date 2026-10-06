import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, musicCutoff, musicLift } from '../audio';

/** Just enough of the Web Audio API to observe what the engine does. */
class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime(v: number) { this.value = v; }
  setTargetAtTime(v: number) { this.value = v; }
  cancelScheduledValues() {}
}
const started: { loop: boolean; stopped: boolean }[] = [];
class FakeCtx {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  createGain() { const n = { gain: new FakeParam(), connect: (x: unknown) => x }; return n; }
  createBiquadFilter() { return { type: '', frequency: new FakeParam(), connect: (x: unknown) => x }; }
  createBufferSource() {
    const rec = { loop: false, stopped: false };
    const src = {
      buffer: null, connect: (x: unknown) => x,
      set loop(v: boolean) { rec.loop = v; }, get loop() { return rec.loop; },
      start: () => { started.push(rec); }, stop: () => { rec.stopped = true; },
    };
    return src;
  }
  decodeAudioData = vi.fn(async () => ({ duration: 27.43 }));
}

/** fetch that resolves only when we say so - to test decode-in-flight races. */
function gatedFetch() {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const f = vi.fn(async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response; });
  return { f, release };
}

describe('music intensity mapping', () => {
  it('is never muffled at rest, fully open at a full streak', () => {
    expect(musicCutoff(0)).toBe(6000);
    expect(Math.round(musicCutoff(1))).toBe(20000);
    expect(musicCutoff(0.5)).toBeGreaterThan(6000);
    expect(musicCutoff(-3)).toBe(6000);
    expect(Math.round(musicCutoff(9))).toBe(20000);
  });
  it('lifts the level a little as the battle heats up', () => {
    expect(musicLift(0)).toBeCloseTo(0.85);
    expect(musicLift(1)).toBeCloseTo(1);
  });
});

describe('AudioEngine loops', () => {
  beforeEach(() => {
    started.length = 0;
    vi.stubGlobal('AudioContext', FakeCtx as unknown as typeof AudioContext);
  });

  it('a loop requested before its buffer decodes starts once it arrives, looping', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const g = gatedFetch();
    void a.preload(g.f);
    const p = a.startLoop('theme');
    expect(started).toHaveLength(0);          // still decoding
    g.release();
    await p;
    expect(started).toHaveLength(1);
    expect(started[0]!.loop).toBe(true);      // gapless Web Audio loop, not <audio loop>
  });

  it('a screen change mid-decode cancels the loop - it never starts late', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const g = gatedFetch();
    void a.preload(g.f);
    const p = a.startLoop('theme');
    a.stopLoop('theme');                      // the player left before it decoded
    g.release();
    await p;
    expect(started).toHaveLength(0);
  });

  it('starting the same loop twice plays it once', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const g = gatedFetch(); g.release();
    await a.preload(g.f);
    await a.startLoop('ambience');
    await a.startLoop('ambience');
    expect(started).toHaveLength(1);
  });

  it('the music switch stops what is playing and resumes it when turned back on', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const g = gatedFetch(); g.release();
    await a.preload(g.f);
    await a.startLoop('theme');
    a.setMusicEnabled(false);
    expect(started[0]!.stopped).toBe(true);
    a.setMusicEnabled(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toHaveLength(2);          // the wanted loop came back
  });

  it('with music off, nothing starts', async () => {
    const a = new AudioEngine();
    await a.unlock();
    a.setMusicEnabled(false);
    const g = gatedFetch(); g.release();
    await a.preload(g.f);
    await a.startLoop('theme');
    expect(started).toHaveLength(0);
  });

  it('BACKGROUND: hiding the app suspends all audio; returning resumes it', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const ctx = (a as unknown as { ctx: FakeCtx }).ctx;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.suspend).toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('without Web Audio (old WebView, tests) everything is a silent no-op', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const a = new AudioEngine();
    await a.unlock();
    expect(a.unlocked).toBe(false);
    await expect(a.startLoop('theme')).resolves.toBeUndefined();
    expect(() => { a.play('hit'); a.setIntensity(1); a.stopLoop('theme'); }).not.toThrow();
  });
});
