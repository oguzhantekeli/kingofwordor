/**
 * Server-side round verification. The client is an input device, never an
 * authority: it sends WHAT HAPPENED (seed + the ordered event log) and the
 * server recomputes WHAT IT EARNED by replaying the log through the same engine.
 *
 * Replay works because the engine is deterministic: the same seed and the same
 * events reproduce the exact prompts and score (see the REPLAY test in
 * round.test.ts). A forged score therefore cannot survive - the server's own
 * replay is the only number that reaches a leaderboard.
 */
import type { Dictionary } from './dictionary';
import type { PromptPools } from './rules';
import { Round, SKIP_PENALTY_MS, configFor } from './round';
import { dailySeed, daysBetween } from './progress';
import type { Lang } from './lang';
import type { Category, Difficulty } from './types';

export interface RoundEvent {
  /** Empty when the event is a skip. */
  word: string;
  /** ms since round start, as the client measured it. */
  at: number;
  skip?: boolean;
}

export interface RoundSubmission {
  /** The dictionary the round was played against. Absent from pre-language clients: English. */
  lang?: Lang;
  mode: 'solo' | 'daily';
  /** dayKey (YYYY-MM-DD) - required for the daily. */
  day: string;
  seed: number;
  difficulty: Difficulty;
  events: readonly RoundEvent[];
  /** What the client says it scored. Never trusted; compared for the audit trail. */
  claimedScore: number;
}

export interface Verdict {
  ok: boolean;
  /** The server's own score. The only one that is ever stored. */
  score: number;
  words: number;
  /** Why it was rejected, or why it was flagged while still accepted. */
  reasons: string[];
  /** True when the client's claim disagreed with the replay. */
  mismatch: boolean;
}

/**
 * The fastest a human can plausibly land consecutive ACCEPTED words. Top
 * typists sustain ~15 keystrokes/s; a 4-letter word plus Enter is 5 strokes,
 * ~0.33 s, before reading the new prompt at all. 250 ms only catches bots.
 */
export const MIN_ACCEPT_GAP_MS = 250;
/** Clock and network slack allowed past the round's end. */
export const END_TOLERANCE_MS = 1500;
export const MAX_EVENTS = 400;

export interface VerifyDeps {
  dict: Dictionary;
  pools: PromptPools;
  viability: ReadonlyMap<string, readonly Category[]>;
  /** Server clock, for the daily's date window. */
  now: Date;
  /** The server's notion of "today" as a dayKey. */
  today: string;
}

export function verifyRound(sub: RoundSubmission, deps: VerifyDeps): Verdict {
  const reasons: string[] = [];
  const reject = (why: string): Verdict => ({
    ok: false, score: 0, words: 0, reasons: [...reasons, why], mismatch: false,
  });

  if (!Array.isArray(sub.events)) return reject('events missing');
  if (sub.events.length > MAX_EVENTS) return reject(`too many events (${sub.events.length})`);
  if (!['squire', 'knight', 'warlord'].includes(sub.difficulty)) return reject('unknown difficulty');
  if (!Number.isInteger(sub.seed) || sub.seed < 0) return reject('bad seed');
  // the caller loads the dictionary named by sub.lang; replaying against any
  // other would score different words and draw different prompts
  if ((sub.lang ?? 'en') !== deps.dict.lang) {
    return reject(`round is ${sub.lang ?? 'en'}, dictionary is ${deps.dict.lang}`);
  }

  if (sub.mode === 'daily') {
    // The daily's seed is not the client's to choose: it is the date's.
    if (sub.seed !== dailySeed(sub.day)) return reject('daily seed does not match its date');
    if (sub.difficulty !== 'knight') return reject('daily must be played at knight');
    // Local calendars span roughly +/-14 h around UTC, so a player's "today"
    // can be the server's yesterday or tomorrow. Anything further is stale.
    const gap = daysBetween(sub.day, deps.today);
    if (gap < -1 || gap > 1) return reject(`daily is for ${sub.day}, not around ${deps.today}`);
  }

  const config = configFor(sub.difficulty, sub.seed);
  const round = new Round(deps.dict, config, { pools: deps.pools, viability: deps.viability });

  let lastAt = -1;
  let lastAccept = -Infinity;
  let skips = 0;
  for (const e of sub.events) {
    if (typeof e.at !== 'number' || !Number.isFinite(e.at) || e.at < 0) return reject('bad timestamp');
    if (e.at < lastAt) return reject('timestamps go backwards');
    lastAt = e.at;
    if (e.skip) {
      skips++;
      round.skip(e.at);
      continue;
    }
    if (typeof e.word !== 'string' || e.word.length > 32) return reject('bad word');
    const { submission } = round.submit(e.word, e.at);
    if (submission.accepted) {
      if (e.at - lastAccept < MIN_ACCEPT_GAP_MS) {
        return reject(`accepted words ${e.at - lastAccept} ms apart (min ${MIN_ACCEPT_GAP_MS})`);
      }
      lastAccept = e.at;
    }
  }

  // every skip took three seconds off the clock
  const effective = config.durationMs - skips * SKIP_PENALTY_MS;
  if (lastAt > effective + END_TOLERANCE_MS) {
    return reject(`last event at ${lastAt} ms, round allowed ${effective} ms`);
  }

  const state = round.state;
  const score = state.totalScore;
  const words = state.submissions.filter((s) => s.accepted).length;
  const mismatch = sub.claimedScore !== score;
  if (mismatch) reasons.push(`claimed ${sub.claimedScore}, replay scored ${score}`);
  return { ok: true, score, words, reasons, mismatch };
}

/**
 * Build the payload from a finished round's log. The game store and the
 * contract test both use this, so the test proves the REAL payload verifies.
 */
export function submissionFromLog(args: {
  lang: Lang;
  mode: 'solo' | 'daily';
  day: string;
  seed: number;
  difficulty: Difficulty;
  log: readonly { word: string; at: number; reason: string | null }[];
  claimedScore: number;
}): RoundSubmission {
  return {
    lang: args.lang,
    mode: args.mode,
    day: args.day,
    seed: args.seed,
    difficulty: args.difficulty,
    events: args.log.map((s) => (s.reason === 'skipped'
      ? { word: '', at: s.at, skip: true }
      : { word: s.word, at: s.at })),
    claimedScore: args.claimedScore,
  };
}
