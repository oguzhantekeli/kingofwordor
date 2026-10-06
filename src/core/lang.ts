/**
 * The languages the game is played in, and how a typed word becomes a
 * dictionary key in each.
 *
 * Import-free on purpose: tools/build-dict.mjs imports this same file (Node 24
 * runs it directly), so the app, the server replay and the word lists can
 * never disagree about what counts as a letter.
 *
 * Accents are folded and letters in their own right are kept - the convention
 * of every popular word game in these languages (Termo for Portuguese,
 * Wordle ES, Sutom/Le Mot for French: accents are filled in for you, while ñ,
 * æ ø å and the Turkish letters have their own keys). So "canción" and
 * "cancion" are the same word, but "año" and "ano" are not.
 */

export const LANGUAGES = ['en', 'es', 'fr', 'nl', 'pt-BR', 'da', 'tr'] as const;
export type Lang = (typeof LANGUAGES)[number];

export interface LangProfile {
  /** BCP 47 tag used for casing: Turkish needs I -> ı and i -> İ. */
  locale: string;
  /** The language's own name for itself, as the picker shows it. */
  name: string;
  /** Every letter, in the order the prompt generator walks them. */
  alphabet: string;
  /** Letters that are letters in their own right here and are never folded. */
  keep: string;
}

export const PROFILES: Readonly<Record<Lang, LangProfile>> = {
  // English stays a-z in this exact order: the order decides which prompt a
  // seed draws, so changing it would change every existing daily.
  en: { locale: 'en', name: 'English', alphabet: 'abcdefghijklmnopqrstuvwxyz', keep: '' },
  es: { locale: 'es', name: 'Español', alphabet: 'abcdefghijklmnñopqrstuvwxyz', keep: 'ñ' },
  fr: { locale: 'fr', name: 'Français', alphabet: 'abcdefghijklmnopqrstuvwxyz', keep: '' },
  nl: { locale: 'nl', name: 'Nederlands', alphabet: 'abcdefghijklmnopqrstuvwxyz', keep: '' },
  'pt-BR': { locale: 'pt-BR', name: 'Português (Brasil)', alphabet: 'abcdefghijklmnopqrstuvwxyz', keep: '' },
  da: { locale: 'da', name: 'Dansk', alphabet: 'abcdefghijklmnopqrstuvwxyzæøå', keep: 'æøå' },
  // The Turkish alphabet has no q, w or x.
  tr: { locale: 'tr', name: 'Türkçe', alphabet: 'abcçdefgğhıijklmnoöprsştuüvyz', keep: 'çğıöşü' },
};

/** Letters Unicode does not decompose, so NFD alone cannot fold them. */
const LIGATURES: Readonly<Record<string, string>> = {
  'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ß': 'ss', 'ĳ': 'ij',
  'ı': 'i', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th',
};

const MARKS = /\p{M}/gu;

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);
}

/** One lowercased character -> its letters in `lang`, or null if it has none. */
function foldChar(ch: string, p: LangProfile): string | null {
  if (p.keep.includes(ch)) return ch;
  const base = LIGATURES[ch] ?? ch.normalize('NFD').replace(MARKS, '');
  if (base === '') return '';
  for (const b of base) if (!p.alphabet.includes(b)) return null;
  return base;
}

function lower(input: string, p: LangProfile): string {
  return input.normalize('NFC').toLocaleLowerCase(p.locale);
}

/**
 * What the player typed -> the dictionary key. Lenient: anything that is not
 * a letter of the language (a digit, an apostrophe, a q in Turkish) is
 * dropped, exactly as the old a-z filter dropped it. Idempotent, so the
 * client, the round engine and the server replay can all apply it.
 */
export function normalizeWord(input: string, lang: Lang): string {
  const p = PROFILES[lang];
  let out = '';
  for (const ch of lower(input, p)) out += foldChar(ch, p) ?? '';
  return out;
}

/**
 * The dictionary build's version: strict. A form with any character the
 * language cannot spell is rejected whole instead of silently losing a letter
 * ("taxi" must not become "tai" in Turkish).
 */
export function foldWord(form: string, lang: Lang): string | null {
  const p = PROFILES[lang];
  let out = '';
  for (const ch of lower(form, p)) {
    const f = foldChar(ch, p);
    if (f === null) return null;
    out += f;
  }
  return out;
}

/** A letter or word for display: "i" is "İ" in Turkish. */
export function upper(s: string, lang: Lang): string {
  return s.toLocaleUpperCase(PROFILES[lang].locale);
}

/**
 * The device's preferred languages -> the first one the game supports.
 * Portuguese from Portugal gets the Brazilian dictionary rather than English:
 * the spelling differs in a few hundred words, the language does not.
 */
export function detectLanguage(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (base === 'pt') return 'pt-BR';
    const hit = LANGUAGES.find((l) => l === base);
    if (hit) return hit;
  }
  return 'en';
}
