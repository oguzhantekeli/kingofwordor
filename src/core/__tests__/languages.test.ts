import { describe, expect, it } from 'vitest';
import {
  LANGUAGES, PROFILES, detectLanguage, foldWord, isLang, normalizeWord, upper, type Lang,
} from '../lang';
import { Round, configFor } from '../round';
import { matchesRule } from '../dictionary';
import { verifyRound, submissionFromLog } from '../verify';
import { dailySeed } from '../progress';
import { CONDITIONS, type Difficulty } from '../types';
import { gameDataFor } from './fixture';

describe('normalizeWord: what a typed word becomes', () => {
  it('folds accents but keeps letters that are letters in their own right', () => {
    expect(normalizeWord('Canción', 'es')).toBe('cancion');
    expect(normalizeWord('AÑO', 'es')).toBe('año');
    expect(normalizeWord('pingüino', 'es')).toBe('pinguino');
    expect(normalizeWord('Cœur', 'fr')).toBe('coeur');
    expect(normalizeWord('ÉTÉ', 'fr')).toBe('ete');
    expect(normalizeWord('Coração', 'pt-BR')).toBe('coracao');
    expect(normalizeWord('ideeën', 'nl')).toBe('ideeen');
    expect(normalizeWord('Blåbær', 'da')).toBe('blåbær');
    expect(normalizeWord('Ø', 'da')).toBe('ø');
    expect(normalizeWord('Ø', 'en')).toBe('o');
  });

  it('REGRESSION GUARD: Turkish casing - I is ı and İ is i, not the other way round', () => {
    expect(normalizeWord('ILIK', 'tr')).toBe('ılık');
    expect(normalizeWord('İYİ', 'tr')).toBe('iyi');
    expect(normalizeWord('ÇİÇEK', 'tr')).toBe('çiçek');
    expect(normalizeWord('ŞEKER', 'tr')).toBe('şeker');
    expect(normalizeWord('Ağaç', 'tr')).toBe('ağaç');
    expect(normalizeWord('kâr', 'tr')).toBe('kar'); // circumflex is not a letter
    // the naive toLowerCase() the engine used to apply gets both wrong
    expect('ILIK'.toLowerCase()).toBe('ilik');
    expect(upper('i', 'tr')).toBe('İ');
    expect(upper('ı', 'tr')).toBe('I');
    expect(upper('i', 'en')).toBe('I');
  });

  it('drops what the language cannot spell, like the old a-z filter did', () => {
    expect(normalizeWord("don't 42", 'en')).toBe('dont');
    expect(normalizeWord('taxi', 'tr')).toBe('tai'); // no x in Turkish: dropped as typed...
    expect(foldWord('taxi', 'tr')).toBeNull();       // ...but the build rejects the whole form
    expect(foldWord('Madrid', 'es')).toBe('madrid');
  });

  it('is idempotent in every language (the server re-normalises logged words)', () => {
    const samples = ['Ünlü', 'ÇAĞRI', 'Ñandú', 'Œuvre', 'Smørrebrød', 'Ação', 'IJsje', 'naïve', 'Straße'];
    for (const lang of LANGUAGES) {
      for (const s of samples) {
        const once = normalizeWord(s, lang);
        expect(normalizeWord(once, lang), `${lang}:${s}`).toBe(once);
        for (const ch of once) expect(PROFILES[lang].alphabet, `${lang}:${s}`).toContain(ch);
      }
    }
  });

  it('picks the first supported device language, Portugal included', () => {
    expect(detectLanguage(['tr-TR', 'en-US'])).toBe('tr');
    expect(detectLanguage(['de-DE', 'fr-CA'])).toBe('fr');
    expect(detectLanguage(['pt-PT'])).toBe('pt-BR');
    expect(detectLanguage(['es_MX'])).toBe('es');
    expect(detectLanguage(['it-IT', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(isLang('pt-BR')).toBe(true);
    expect(isLang('it')).toBe(false);
  });

  it('every alphabet is unique letters, all lowercase, all kept or plain', () => {
    for (const lang of LANGUAGES) {
      const { alphabet, keep } = PROFILES[lang];
      expect(new Set(alphabet).size, lang).toBe([...alphabet].length);
      expect(alphabet, lang).toBe(alphabet.toLocaleLowerCase(PROFILES[lang].locale));
      for (const k of keep) expect(alphabet, lang).toContain(k);
      expect([...alphabet].length, lang).toBeLessThanOrEqual(31); // stats use a 32-bit letter mask
    }
  });
});

/** Words a native speaker plays in a minute, and words that must not count. */
const SPOT: Record<Exclude<Lang, 'en'>, { yes: string[]; no: string[] }> = {
  es: { yes: ['casa', 'Canción', 'niño', 'pingüino', 'comíamos', 'tenés', 'espada', 'castillo'], no: ['madrid', 'zzzz', 'asdf'] },
  // not zzzz: Grammalecte lists zzz and zzzz (snoring) as words
  fr: { yes: ['maison', 'cœur', 'été', 'chevaux', 'mangeassions', 'épée', 'château', 'ognon', 'oignon'], no: ['qwxz', 'asdf'] },
  nl: { yes: ['huis', 'zwaard', 'kasteel', 'ideeën', 'hoofdstad', 'supermarkt', 'technologen'], no: ['musica', 'zzzz'] },
  'pt-BR': { yes: ['casa', 'coração', 'espada', 'castelo', 'falávamos', 'cavaleiro'], no: ['zzzz', 'asdf'] },
  da: { yes: ['hus', 'sværd', 'slot', 'blåbær', 'æble', 'kartoffelchips', 'ridder'], no: ['tyskland', 'zzzz'] },
  tr: { yes: ['kitap', 'kitaplar', 'ılık', 'güzel', 'öğretmen', 'şeker', 'çiçek', 'ağaç', 'kılıç', 'şövalye', 'KİTAP', 'ILIK'], no: ['istanbul', 'antalya', 'vietnam', 'zzzz', 'ğığğı'] },
};

describe.each(Object.keys(SPOT) as Exclude<Lang, 'en'>[])('%s dictionary', (lang) => {
  const data = gameDataFor(lang);
  const { dict, pools, viability } = data;

  it('declares its language and alphabet', () => {
    expect(dict.lang).toBe(lang);
    expect(dict.alphabet).toBe(PROFILES[lang].alphabet);
    expect(dict.everydayMaxTier).toBe(40);
    expect(dict.maxTier).toBe(50); // every word is accepted at every difficulty
    expect(dict.size).toBeGreaterThan(200_000);
  });

  it('accepts real words and refuses names and noise', () => {
    for (const w of SPOT[lang].yes) expect(dict.has(normalizeWord(w, lang)), w).toBe(true);
    for (const w of SPOT[lang].no) expect(dict.has(normalizeWord(w, lang)), w).toBe(false);
  });

  it('has no category data - WordNet is English-only - so no bonus is ever offered', () => {
    for (const cats of viability.values()) expect(cats).toEqual([]);
    expect(dict.categoriesOf(normalizeWord(SPOT[lang].yes[0]!, lang))).toEqual([]);
  });

  const difficulties: Difficulty[] = ['squire', 'knight', 'warlord'];
  it.each(difficulties)('%s draws only winnable prompts in 20,000 draws', (difficulty) => {
    const r = new Round(dict, configFor(difficulty, 99), { pools, viability });
    // @ts-expect-error - the generator is private; draw from it directly
    const next: () => { band: string; everydayCount: number } = r.nextPrompt;
    for (let i = 0; i < 20_000; i++) {
      const p = next();
      expect(p.band).not.toBe('impossible');
      expect(p.everydayCount).toBeGreaterThan(0);
    }
  });

  it('every prompt in every playable band is answerable at its rank', () => {
    const words = dict.list();
    for (const band of ['trivial', 'easy', 'medium', 'hard'] as const) {
      for (const [c, l] of pools.byBand[band]) {
        expect(words.some((w) => w.length >= 4 && matchesRule(w, c, l)), `${c}:${l}`).toBe(true);
      }
    }
  });

  it('prompt pools cover every condition x letter of its alphabet', () => {
    const total = Object.values(pools.byBand).reduce((n, p) => n + p.length, 0);
    expect(total).toBe(CONDITIONS.length * [...dict.alphabet].length);
  });

  it('a daily played through the engine replays to the same score on the server', () => {
    const day = '2026-10-07';
    const r = new Round(dict, configFor('knight', dailySeed(day)), { pools, viability });
    const words = dict.list();
    let at = 1000;
    for (let i = 0; i < 8; i++) {
      const p = r.state.prompt;
      const w = words.find((c) => c.length >= 4 && c.length <= 9 && !r.playedWords.has(c)
        && matchesRule(c, p.condition, p.letter));
      if (w) r.submit(upper(w, lang), at); else r.skip(at); // typed in capitals, on purpose
      at += 1500;
    }
    expect(r.state.totalScore).toBeGreaterThan(0);
    const sub = submissionFromLog({
      lang, mode: 'daily', day, seed: dailySeed(day), difficulty: 'knight',
      log: r.state.submissions, claimedScore: r.state.totalScore,
    });
    const v = verifyRound(sub, { dict, pools, viability, now: new Date(2026, 9, 7, 12), today: day });
    expect(v.ok).toBe(true);
    expect(v.mismatch).toBe(false);
    expect(v.score).toBe(r.state.totalScore);
    // and a round claimed for another language's dictionary is refused outright
    const wrong = verifyRound({ ...sub, lang: lang === 'tr' ? 'es' : 'tr' }, {
      dict, pools, viability, now: new Date(2026, 9, 7, 12), today: day,
    });
    expect(wrong.ok).toBe(false);
  });
});
