/**
 * CONTRACT: a round played through the real game store produces a payload that
 * the server's verifier accepts with the identical score. If the client's event
 * log and the server's replay ever disagree, this fails - before a real player's
 * honest score is rejected in production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { useGame } from '../store/gameStore';
import { buildGameData } from '../core/load';
import { matchesRule } from '../core/dictionary';
import { submissionFromLog, verifyRound } from '../core/verify';
import { dayKey } from '../core/progress';

const buf = fs.readFileSync(path.resolve('public/dict/en.kowd'));
const data = buildGameData(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const words = data.dict.list();

function playThroughStore(mode: 'solo' | 'daily', now: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  useGame.setState({ data, screen: 'welcome' });
  if (mode === 'daily') useGame.getState().startDaily(now);
  else useGame.getState().startRound('warlord', 31337);
  useGame.setState({ screen: 'playing' });

  for (let i = 0; i < 12; i++) {
    vi.advanceTimersByTime(1800);              // a human pace, ~1.8 s per action
    const { prompt: p, round } = useGame.getState();
    if (i === 3 || i === 8) { useGame.getState().skip(); continue; }
    if (i === 5) { useGame.getState().submit('zzqqzz'); continue; } // a miss
    const w = words.find((c) => c.length >= round!.config.minWordLength && c.length <= 8
      && !round!.playedWords.has(c) && (data.dict.tierOf(c) ?? 99) <= round!.config.maxTier
      && matchesRule(c, p!.condition, p!.letter))!;
    useGame.getState().submit(w);
  }
  const s = useGame.getState();
  const sub = submissionFromLog({
    lang: data.dict.lang, mode, day: s.day, seed: s.round!.config.seed, difficulty: s.round!.config.difficulty,
    log: s.submissions, claimedScore: s.totalScore,
  });
  vi.useRealTimers();
  return { sub, clientScore: s.totalScore };
}

describe('client -> server contract', () => {
  it('a solo round played in the store verifies to the same score', () => {
    const now = new Date(2026, 9, 6, 14, 0);
    const { sub, clientScore } = playThroughStore('solo', now);
    const v = verifyRound(sub, { ...data, now, today: dayKey(now) });
    expect(v.reasons).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.score).toBe(clientScore);
    expect(v.mismatch).toBe(false);
    expect(sub.events.filter((e) => e.skip)).toHaveLength(2);
  });

  it('a daily siege played in the store verifies to the same score', () => {
    const now = new Date(2026, 9, 6, 20, 0);
    const { sub, clientScore } = playThroughStore('daily', now);
    expect(sub.mode).toBe('daily');
    const v = verifyRound(sub, { ...data, now, today: dayKey(now) });
    expect(v.ok).toBe(true);
    expect(v.score).toBe(clientScore);
  });
});
