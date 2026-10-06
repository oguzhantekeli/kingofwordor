/**
 * Progression and the daily siege. Pure functions: no storage, no clock - the
 * caller passes dates in, so every rule here is testable.
 *
 * Why these two systems: GameAnalytics' 2025 benchmarks tie D7 retention to
 * habit formation and D30 to progression depth, and Duolingo's own published
 * experiments measured +14% D7 retention from streak mechanics. A rank ladder
 * gives every round a reason beyond its score; a once-a-day siege with a streak
 * gives every day a reason to come back.
 */

/**
 * The ladder ends at the game's own title. Distinct from the difficulty names
 * (squire / knight / warlord) so "Knight" never means two things.
 */
export const RANKS = [
  { id: 'peasant', xp: 0 },
  { id: 'footman', xp: 400 },
  { id: 'manAtArms', xp: 1200 },
  { id: 'sergeant', xp: 3000 },
  { id: 'captain', xp: 6500 },
  { id: 'baron', xp: 12000 },
  { id: 'earl', xp: 21000 },
  { id: 'duke', xp: 35000 },
  { id: 'king', xp: 60000 },
] as const;
export type RankId = (typeof RANKS)[number]['id'];

export interface RankInfo {
  id: RankId;
  index: number;
  /** XP at which this rank began. */
  floor: number;
  /** XP needed for the next rank, or null at the top. */
  next: number | null;
  /** 0..1 progress toward the next rank (1 at the top). */
  progress: number;
}

export function rankFor(xp: number): RankInfo {
  const x = Math.max(0, Math.floor(xp));
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (x >= RANKS[k]!.xp) i = k;
  const cur = RANKS[i]!;
  const nxt = RANKS[i + 1];
  return {
    id: cur.id,
    index: i,
    floor: cur.xp,
    next: nxt ? nxt.xp : null,
    progress: nxt ? (x - cur.xp) / (nxt.xp - cur.xp) : 1,
  };
}

/** XP earned by a round. A round always earns something, so a bad run still counts. */
export function xpForRound(points: number, daily: boolean): number {
  const base = Math.max(0, Math.round(points)) + 10;
  return daily ? base * 2 : base;
}

// ----------------------------------------------------------- the daily

/** 'YYYY-MM-DD' in the player's local calendar - "today" means their today. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The same seed for everyone on the same date: FNV-1a over the date string.
 * The prompt generator is already deterministic per seed, so this one number
 * is the whole daily puzzle.
 */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Siege #1 is launch day. Used in the share text: "Daily Siege #12". */
export const DAILY_EPOCH = '2026-10-01';

export function dailyNumber(key: string): number {
  const a = Date.UTC(...ymd(DAILY_EPOCH));
  const b = Date.UTC(...ymd(key));
  return Math.floor((b - a) / 86_400_000) + 1;
}

function ymd(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m! - 1, d!];
}

export interface StreakState {
  /** dayKey of the last daily played, or null. */
  last: string | null;
  streak: number;
  best: number;
}

/** Days between two day keys (b - a), calendar-exact across DST and month ends. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000);
}

/**
 * Record today's daily. Playing again the same day changes nothing; playing the
 * day after extends the streak; any gap resets it to 1.
 */
export function recordDaily(prev: StreakState, today: string): StreakState {
  if (prev.last === today) return prev;
  const streak = prev.last !== null && daysBetween(prev.last, today) === 1 ? prev.streak + 1 : 1;
  return { last: today, streak, best: Math.max(prev.best, streak) };
}

/** The streak as it stands right now: still alive only if the last daily was today or yesterday. */
export function liveStreak(s: StreakState, today: string): number {
  if (s.last === null) return 0;
  const gap = daysBetween(s.last, today);
  return gap === 0 || gap === 1 ? s.streak : 0;
}

export function playedToday(s: StreakState, today: string): boolean {
  return s.last === today;
}

/** Milliseconds until the next local midnight - when the next siege opens. */
export function msUntilNextDaily(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}
