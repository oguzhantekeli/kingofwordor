export const CONDITIONS = ['startsWith', 'endsWith', 'includes'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CATEGORIES = [
  'animal', 'food', 'person', 'plant', 'body',
  'place', 'object', 'substance', 'time', 'communication',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** SCOWL size tiers, ascending = rarer. Mirrors tools/build-dict.mjs TIERS. */
export const TIERS = [10, 20, 35, 40, 50, 55, 60, 70] as const;
export type Tier = (typeof TIERS)[number];

/** A word is "everyday" at or below this SCOWL tier (audit §5). */
export const EVERYDAY_MAX_TIER = 50;

export type Difficulty = 'squire' | 'knight' | 'warlord';

export type Band = 'impossible' | 'hard' | 'medium' | 'easy' | 'trivial';

export interface Prompt {
  condition: Condition;
  letter: string;
  /** Category hint, or null when the prompt has no viable category (audit §6). */
  category: Category | null;
  /** Words at or below EVERYDAY_MAX_TIER that satisfy this prompt. */
  everydayCount: number;
  /** Words in the accepted dictionary that satisfy this prompt. */
  acceptedCount: number;
  band: Band;
}

export type RejectReason =
  | 'tooShort'
  | 'duplicate'
  | 'ruleMismatch'
  | 'notAWord'
  /** Not a rejection of a word: the player chose to skip the prompt. */
  | 'skipped';

export interface Submission {
  word: string;
  accepted: boolean;
  reason: RejectReason | null;
  points: number;
  tier: Tier | null;
  matchedCategory: boolean;
  /** ms since round start, for server-side rate validation. */
  at: number;
}

export interface RoundConfig {
  difficulty: Difficulty;
  durationMs: number;
  minWordLength: number;
  /** Words at or below this tier are accepted. */
  maxTier: Tier;
  seed: number;
}
