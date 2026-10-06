import {
  CATEGORIES, CONDITIONS, TIERS,
  type Category, type Condition, type Tier,
} from './types';
import { isLang, PROFILES, type Lang } from './lang';

const MAGIC = 'KOWD';
const FORMAT_VERSION = 2;
const HEADER_BYTES = 32;

/** A category hint must have at least this many everyday words behind it. */
export const MIN_CATEGORY_WORDS = 8;

/** Per-(condition, letter) word counts, used for rarity scoring and difficulty. */
export interface PromptStats {
  everyday: number;
  accepted: number;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
/** Every alphabet's letters sit below U+0180 (ş is U+015F). */
const CODE_POINTS = 0x180;

/**
 * A packed word list (layout: tools/kowd.mjs), kept as the bytes it arrived in.
 *
 * Words are never turned into strings. A million-word Portuguese list as a
 * Map of strings costs tens of megabytes in a phone's WebView; as bytes plus
 * one offset per word it costs its file size plus 4 bytes a word, and a
 * lookup is a ~20-step binary search over sorted UTF-8.
 */
export class Dictionary {
  readonly size: number;
  readonly lang: Lang;
  /** Prompt letters, in the order the prompt generator walks them. */
  readonly alphabet: string;
  readonly maxTier: Tier;
  /** Words at or below this tier are "everyday": the pool difficulty is measured on. */
  readonly everydayMaxTier: Tier;
  /** Prompt band thresholds scale by bandScale / 1000 (exactly 1000 for English). */
  readonly bandScale: number;
  /** Per prompt key, the categories with MIN_CATEGORY_WORDS everyday words; [] without category data. */
  readonly viability: ReadonlyMap<string, readonly Category[]>;
  private readonly text: Uint8Array;
  /** Byte offset of each word; word i ends at starts[i + 1] - 1. */
  private readonly starts: Uint32Array;
  private readonly tiers: Uint8Array;
  private readonly masks: Uint16Array | null;
  private readonly stats: Map<string, PromptStats>;
  private readonly maxEveryday: number;

  private constructor(
    lang: Lang, count: number, text: Uint8Array, tiers: Uint8Array,
    masks: Uint16Array | null, everydayMaxTier: Tier, bandScale: number
  ) {
    this.lang = lang;
    this.alphabet = PROFILES[lang].alphabet;
    this.size = count;
    this.text = text;
    this.tiers = tiers;
    this.masks = masks;
    this.everydayMaxTier = everydayMaxTier;
    this.bandScale = bandScale;
    this.starts = new Uint32Array(count + 1);

    const letters = [...this.alphabet];
    const A = letters.length;
    const index = new Int16Array(CODE_POINTS).fill(-1);
    letters.forEach((l, i) => { index[l.codePointAt(0)!] = i; });
    const accepted = new Int32Array(3 * A);
    const everyday = new Int32Array(3 * A);
    const C = CATEGORIES.length;
    const cats = masks ? new Int32Array(3 * A * C) : null;
    let maxTier: Tier = TIERS[0];

    const add = (k: number, isEveryday: boolean, mask: number) => {
      accepted[k]!++;
      if (isEveryday) everyday[k]!++;
      if (mask !== 0) for (let c = 0; c < C; c++) if (mask & (1 << c)) cats![k * C + c]!++;
    };

    // One pass: offsets, order and alphabet validation, prompt statistics.
    let pos = 0;
    for (let w = 0; w < count; w++) {
      const begin = pos;
      let first = -1, last = -1, seen = 0;
      while (pos < text.length && text[pos] !== 0x0a) {
        const b = text[pos]!;
        let cp: number;
        if (b < 0x80) { cp = b; pos += 1; }
        else if ((b & 0xe0) === 0xc0) { cp = ((b & 0x1f) << 6) | (text[pos + 1]! & 0x3f); pos += 2; }
        else throw new Error(`kowd: word ${w} is not in the ${lang} alphabet`);
        const li = cp < CODE_POINTS ? index[cp]! : -1;
        if (li < 0) throw new Error(`kowd: word ${w} is not in the ${lang} alphabet`);
        if (first < 0) first = li;
        last = li;
        seen |= 1 << li;
      }
      if (first < 0) throw new Error(`kowd: word count mismatch (empty word at ${w})`);
      if (w > 0 && compare(text, this.starts[w - 1]!, begin - 1, text, begin, pos) >= 0) {
        throw new Error(`kowd: words out of order at ${w}`);
      }
      this.starts[w] = begin;
      pos++; // the '\n', or one past the end after the last word
      const tier = TIERS[nibble(tiers, w)];
      if (tier === undefined) throw new Error(`kowd: word ${w} has no valid tier`);
      if (tier > maxTier) maxTier = tier;
      const isEveryday = tier <= everydayMaxTier;
      const mask = masks && isEveryday ? masks[w]! : 0;
      add(first, isEveryday, mask);
      add(A + last, isEveryday, mask);
      for (let s = seen; s !== 0; s &= s - 1) add(2 * A + 31 - Math.clz32(s & -s), isEveryday, mask);
    }
    if (pos !== text.length + 1 && !(count === 0 && text.length === 0)) {
      throw new Error(`kowd: word count mismatch (header ${count}, text holds more)`);
    }
    this.starts[count] = text.length + 1;
    this.maxTier = maxTier;

    this.stats = new Map();
    const viability = new Map<string, Category[]>();
    let maxEveryday = 0;
    CONDITIONS.forEach((cond, ci) => {
      letters.forEach((l, li) => {
        const k = ci * A + li;
        this.stats.set(key(cond, l), { everyday: everyday[k]!, accepted: accepted[k]! });
        if (everyday[k]! > maxEveryday) maxEveryday = everyday[k]!;
        viability.set(key(cond, l), cats
          ? CATEGORIES.filter((_, c) => cats[k * C + c]! >= MIN_CATEGORY_WORDS)
          : []);
      });
    });
    this.maxEveryday = maxEveryday;
    this.viability = viability;
  }

  /**
   * Parse a packed dictionary. Throws on a malformed, wrong-version or
   * unsorted blob rather than producing a dictionary that rejects every word.
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
    const lang = String.fromCharCode(...bytes.subarray(16, 24)).replace(/\0+$/, '');
    if (!isLang(lang)) throw new Error(`kowd: unsupported language "${lang}"`);
    const everydayMaxTier = TIERS.find((t) => t === bytes[24]);
    if (everydayMaxTier === undefined) throw new Error(`kowd: bad everyday tier ${bytes[24]}`);
    const hasMasks = (bytes[25]! & 1) === 1;
    const bandScale = view.getUint16(26, true);
    if (bandScale === 0) throw new Error('kowd: band scale is 0');

    const tiersOff = HEADER_BYTES;
    const masksOff = tiersOff + Math.ceil(count / 2);
    const textOff = masksOff + (hasMasks ? count * 2 : 0);
    if (textOff + textLen !== bytes.byteLength) {
      throw new Error(
        `kowd: size mismatch (expected ${textOff + textLen}, got ${bytes.byteLength})`
      );
    }
    const masks = hasMasks ? new Uint16Array(bytes.slice(masksOff, textOff).buffer) : null;
    return new Dictionary(
      lang, count, bytes.subarray(textOff), bytes.subarray(tiersOff, masksOff),
      masks, everydayMaxTier, bandScale
    );
  }

  /** Index of a word, or -1. Case-insensitive in the dictionary's own locale. */
  private find(word: string): number {
    const q = ENCODER.encode(word.toLocaleLowerCase(PROFILES[this.lang].locale));
    let lo = 0;
    let hi = this.size - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const c = compare(this.text, this.starts[mid]!, this.starts[mid + 1]! - 1, q, 0, q.length);
      if (c === 0) return mid;
      if (c < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  /** Case-insensitive membership. This is the check the old app got wrong. */
  has(word: string): boolean {
    return this.find(word) >= 0;
  }

  tierOf(word: string): Tier | null {
    const i = this.find(word);
    if (i < 0) return null;
    return TIERS[nibble(this.tiers, i)] ?? null;
  }

  categoriesOf(word: string): Category[] {
    const i = this.find(word);
    if (i < 0 || !this.masks) return [];
    const mask = this.masks[i] ?? 0;
    return CATEGORIES.filter((_, bit) => (mask & (1 << bit)) !== 0);
  }

  hasCategory(word: string, category: Category): boolean {
    const i = this.find(word);
    if (i < 0 || !this.masks) return false;
    const bit = CATEGORIES.indexOf(category);
    return bit >= 0 && ((this.masks[i] ?? 0) & (1 << bit)) !== 0;
  }

  statsFor(condition: Condition, letter: string): PromptStats {
    return this.stats.get(key(condition, letter)) ?? { everyday: 0, accepted: 0 };
  }

  /** Largest `everyday` count across all prompts; the rarity scale's baseline. */
  maxEverydayCount(): number {
    return this.maxEveryday;
  }

  wordAt(i: number): string {
    if (i < 0 || i >= this.size) throw new RangeError(`no word ${i}`);
    return DECODER.decode(this.text.subarray(this.starts[i]!, this.starts[i + 1]! - 1));
  }

  /**
   * Every word as a string. For tests and tools only: it allocates exactly
   * what the byte representation exists to avoid.
   */
  list(): string[] {
    return Array.from({ length: this.size }, (_, i) => this.wordAt(i));
  }
}

function nibble(tiers: Uint8Array, i: number): number {
  const byte = tiers[i >> 1] ?? 0;
  return i % 2 === 0 ? byte & 0x0f : byte >> 4;
}

function key(condition: Condition, letter: string): string {
  return `${condition}:${letter}`;
}

/** Byte order of a[a0, a1) against b[b0, b1) - UTF-8 byte order is code point order. */
function compare(a: Uint8Array, a0: number, a1: number, b: Uint8Array, b0: number, b1: number): number {
  let i = a0;
  let j = b0;
  for (; i < a1 && j < b1; i++, j++) {
    const d = a[i]! - b[j]!;
    if (d !== 0) return d;
  }
  return (a1 - i) - (b1 - j);
}

/** Does `word` satisfy the letter rule? Both sides arrive as dictionary keys. */
export function matchesRule(word: string, condition: Condition, letter: string): boolean {
  const w = word.toLowerCase();
  const l = letter.toLowerCase();
  switch (condition) {
    case 'startsWith': return w.startsWith(l);
    case 'endsWith': return w.endsWith(l);
    case 'includes': return w.includes(l);
  }
}
