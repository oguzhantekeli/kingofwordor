import {
  CATEGORIES, CONDITIONS, EVERYDAY_MAX_TIER, TIERS,
  type Category, type Condition, type Tier,
} from './types';

const MAGIC = 'KOWD';
const FORMAT_VERSION = 1;
const HEADER_BYTES = 16;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** Per-(condition, letter) word counts, used for rarity scoring and difficulty. */
export interface PromptStats {
  everyday: number;
  accepted: number;
}

export class Dictionary {
  readonly size: number;
  readonly maxTier: Tier;
  private readonly index: Map<string, number>;
  private readonly tiers: Uint8Array;
  private readonly masks: Uint16Array;
  private readonly stats: Map<string, PromptStats>;

  private constructor(
    words: string[], tiers: Uint8Array, masks: Uint16Array, maxTier: Tier
  ) {
    this.size = words.length;
    this.maxTier = maxTier;
    this.tiers = tiers;
    this.masks = masks;
    this.index = new Map();
    for (let i = 0; i < words.length; i++) this.index.set(words[i]!, i);
    this.stats = buildStats(words, (i) => nibble(tiers, i));
  }

  /**
   * Parse the packed dictionary. Throws on a malformed or wrong-version blob
   * rather than silently producing a dictionary that rejects every word.
   */
  static parse(buffer: ArrayBuffer): Dictionary {
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength < HEADER_BYTES) throw new Error('kowd: truncated header');
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic !== MAGIC) throw new Error(`kowd: bad magic "${magic}"`);
    const view = new DataView(buffer);
    const version = view.getUint32(4, true);
    if (version !== FORMAT_VERSION) {
      throw new Error(`kowd: unsupported format version ${version}`);
    }
    const count = view.getUint32(8, true);
    const textLen = view.getUint32(12, true);
    const tiersOff = HEADER_BYTES;
    const tiersLen = Math.ceil(count / 2);
    const masksOff = tiersOff + tiersLen;
    const textOff = masksOff + count * 2;
    if (textOff + textLen !== bytes.byteLength) {
      throw new Error(
        `kowd: size mismatch (expected ${textOff + textLen}, got ${bytes.byteLength})`
      );
    }
    const tiers = bytes.slice(tiersOff, masksOff);
    const masks = new Uint16Array(bytes.slice(masksOff, textOff).buffer);
    const words = new TextDecoder().decode(bytes.subarray(textOff)).split('\n');
    if (words.length !== count) {
      throw new Error(`kowd: word count mismatch (header ${count}, parsed ${words.length})`);
    }
    let max: Tier = TIERS[0];
    for (let i = 0; i < count; i++) {
      const t = TIERS[nibble(tiers, i)];
      if (t !== undefined && t > max) max = t;
    }
    return new Dictionary(words, tiers, masks, max);
  }

  /** Case-insensitive membership. This is the check the old app got wrong. */
  has(word: string): boolean {
    return this.index.has(word.toLowerCase());
  }

  tierOf(word: string): Tier | null {
    const i = this.index.get(word.toLowerCase());
    if (i === undefined) return null;
    return TIERS[nibble(this.tiers, i)] ?? null;
  }

  categoriesOf(word: string): Category[] {
    const i = this.index.get(word.toLowerCase());
    if (i === undefined) return [];
    const mask = this.masks[i] ?? 0;
    return CATEGORIES.filter((_, bit) => (mask & (1 << bit)) !== 0);
  }

  hasCategory(word: string, category: Category): boolean {
    const i = this.index.get(word.toLowerCase());
    if (i === undefined) return false;
    const bit = CATEGORIES.indexOf(category);
    return bit >= 0 && ((this.masks[i] ?? 0) & (1 << bit)) !== 0;
  }

  statsFor(condition: Condition, letter: string): PromptStats {
    return this.stats.get(key(condition, letter)) ?? { everyday: 0, accepted: 0 };
  }

  /** Largest `everyday` count across all prompts; the rarity scale's baseline. */
  maxEverydayCount(): number {
    let max = 0;
    for (const s of this.stats.values()) if (s.everyday > max) max = s.everyday;
    return max;
  }
}

function nibble(tiers: Uint8Array, i: number): number {
  const byte = tiers[i >> 1] ?? 0;
  return i % 2 === 0 ? byte & 0x0f : byte >> 4;
}

function key(condition: Condition, letter: string): string {
  return `${condition}:${letter}`;
}

function buildStats(
  words: readonly string[], tierAt: (i: number) => number
): Map<string, PromptStats> {
  const stats = new Map<string, PromptStats>();
  for (const c of CONDITIONS) {
    for (const l of ALPHABET) stats.set(key(c, l), { everyday: 0, accepted: 0 });
  }
  const seen = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const tier = TIERS[tierAt(i)] ?? 95;
    const everyday = tier <= EVERYDAY_MAX_TIER;
    bump(stats, 'startsWith', w[0]!, everyday);
    bump(stats, 'endsWith', w[w.length - 1]!, everyday);
    seen.clear();
    for (const ch of w) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      bump(stats, 'includes', ch, everyday);
    }
  }
  return stats;
}

function bump(
  stats: Map<string, PromptStats>, c: Condition, letter: string, everyday: boolean
): void {
  const s = stats.get(key(c, letter));
  if (!s) return;
  s.accepted++;
  if (everyday) s.everyday++;
}

/** Does `word` satisfy the letter rule? Always case-insensitive. */
export function matchesRule(word: string, condition: Condition, letter: string): boolean {
  const w = word.toLowerCase();
  const l = letter.toLowerCase();
  switch (condition) {
    case 'startsWith': return w.startsWith(l);
    case 'endsWith': return w.endsWith(l);
    case 'includes': return w.includes(l);
  }
}
