import { Dictionary, matchesRule } from './dictionary';
import { normalizeWord } from './lang';
import { createPromptGenerator, type PromptGeneratorOptions } from './rules';
import { scoreWord } from './scoring';

/**
 * Skipping costs round time, so it is a decision rather than a free action.
 * Exported because the server re-derives round timing from the same rule.
 */
export const SKIP_PENALTY_MS = 3000;
import type {
  Category, Difficulty, Prompt, RejectReason, RoundConfig, Submission, Tier,
} from './types';

export const DIFFICULTY_DEFAULTS: Readonly<
  Record<Difficulty, { durationMs: number; minWordLength: number; maxTier: Tier }>
> = {
  squire: { durationMs: 90_000, minWordLength: 3, maxTier: 50 },
  knight: { durationMs: 60_000, minWordLength: 4, maxTier: 60 },
  warlord: { durationMs: 45_000, minWordLength: 4, maxTier: 70 },
};

export interface RoundState {
  readonly config: RoundConfig;
  readonly prompt: Prompt;
  readonly submissions: readonly Submission[];
  readonly totalScore: number;
  readonly finished: boolean;
}

export interface SubmitResult {
  readonly state: RoundState;
  readonly submission: Submission;
}

/**
 * Pure round engine. No React, no timers, no platform calls - the caller owns
 * the clock and passes `atMs`. Every defect found in the audited app lived in
 * logic tangled with React state; this module is testable without a DOM.
 */
export class Round {
  readonly config: RoundConfig;
  private readonly dict: Dictionary;
  private readonly nextPrompt: () => Prompt;
  private readonly maxEveryday: number;
  private readonly played = new Set<string>();
  private prompt: Prompt;
  private submissions: Submission[] = [];
  private total = 0;
  private done = false;

  constructor(
    dict: Dictionary,
    config: RoundConfig,
    generatorDeps: Omit<PromptGeneratorOptions, 'dict' | 'difficulty' | 'seed'>
  ) {
    this.dict = dict;
    this.config = config;
    this.maxEveryday = dict.maxEverydayCount();
    this.nextPrompt = createPromptGenerator({
      dict,
      difficulty: config.difficulty,
      seed: config.seed,
      ...generatorDeps,
    });
    this.prompt = this.nextPrompt();
  }

  get state(): RoundState {
    return {
      config: this.config,
      prompt: this.prompt,
      submissions: this.submissions,
      totalScore: this.total,
      finished: this.done,
    };
  }

  /** Words already played this round, as dictionary keys. */
  get playedWords(): ReadonlySet<string> {
    return this.played;
  }

  finish(): void {
    this.done = true;
  }

  /**
   * Abandon the current prompt for a new one. Logged as an event so the server
   * can replay the exact prompt sequence: the prompt advances on an accepted
   * word or a skip, and on nothing else.
   */
  skip(atMs: number): SubmitResult {
    const submission: Submission = {
      word: '', accepted: false, reason: 'skipped', points: 0, tier: null,
      matchedCategory: false, at: atMs,
    };
    if (this.done) return { state: this.state, submission };
    this.submissions = [...this.submissions, submission];
    this.prompt = this.nextPrompt();
    return { state: this.state, submission };
  }

  submit(raw: string, atMs: number): SubmitResult {
    // The dictionary key, in the dictionary's language: folded accents,
    // Turkish casing. Idempotent, so the server replaying the logged word
    // reaches the same key.
    const word = normalizeWord(raw, this.dict.lang);
    const reject = (reason: RejectReason): SubmitResult => {
      const submission: Submission = {
        word, accepted: false, reason, points: 0, tier: null,
        matchedCategory: false, at: atMs,
      };
      this.submissions = [...this.submissions, submission];
      // A rejected word KEEPS the prompt. Advancing on rejection meant a single
      // typo threw away the prompt the player was halfway through answering,
      // and it made typing junk a free skip. Skipping is now explicit and
      // costs time - see skip().
      return { state: this.state, submission };
    };

    if (this.done) return reject('notAWord');
    if (word.length < this.config.minWordLength) return reject('tooShort');
    if (this.played.has(word)) return reject('duplicate');
    if (!matchesRule(word, this.prompt.condition, this.prompt.letter)) {
      return reject('ruleMismatch');
    }
    const tier = this.dict.tierOf(word);
    if (tier === null || tier > this.config.maxTier) return reject('notAWord');

    const matchedCategory =
      this.prompt.category !== null &&
      this.dict.hasCategory(word, this.prompt.category as Category);
    const points = scoreWord({
      word, tier, prompt: this.prompt,
      maxEverydayCount: this.maxEveryday, matchedCategory,
    });

    this.played.add(word);
    this.total += points;
    const submission: Submission = {
      word, accepted: true, reason: null, points, tier, matchedCategory, at: atMs,
    };
    this.submissions = [...this.submissions, submission];
    this.prompt = this.nextPrompt();
    return { state: this.state, submission };
  }
}

export function configFor(difficulty: Difficulty, seed: number): RoundConfig {
  const d = DIFFICULTY_DEFAULTS[difficulty];
  return { difficulty, seed, ...d };
}
