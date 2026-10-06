/**
 * Where every non-English word list comes from, pinned, and the licence each
 * one is used under. Shared by tools/build-dict.mjs and tools/build-freq.mjs.
 *
 * All from the LibreOffice dictionaries repository at one commit. Licences as
 * stated in each folder's own README / LICENSE at that commit:
 *
 *   es     GPL-3+ / LGPL-3+ / MPL-1.1+, "puede seleccionar libremente": used under MPL
 *   fr     MPL-2.0 (Grammalecte, Olivier R.)
 *   nl     BSD-3-Clause and/or CC BY 3.0 (OpenTaal): used under BSD-3-Clause
 *   pt-BR  LGPL-3 / MPL (VERO, Raimundo Santos Moura): used under MPL
 *   da     GPL-2 / LGPL-2.1 / MPL-1.1 (Stavekontrolden): used under MPL
 *   tr     MPL-2.0 (Turkish Data Depository, tdd-ai/hunspell-tr)
 *
 * Not here, on purpose: German (GPL-2/3 only) and Italian (GPL-3 only, both
 * the current LibreItalia 5.1 and the legacy 2.4 it forked) - a GPL-only word
 * list cannot ship inside a closed app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseAff, parseDic } from './hunspell.mjs';
import { foldWord } from '../src/core/lang.ts';
import { MIN_LEN, MAX_LEN } from './kowd.mjs';

export const LIBREOFFICE_COMMIT = '32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4';
const RAW = `https://raw.githubusercontent.com/LibreOffice/dictionaries/${LIBREOFFICE_COMMIT}`;
const CACHE = path.join('.cache', 'libreoffice', LIBREOFFICE_COMMIT);

/**
 * Spanish ships one dictionary per country. The union is used so a word valid
 * in Buenos Aires or Mexico City is valid everywhere (voseo, regional words).
 * Measured at this commit: 11 of the 23 add words, the other 12 add none.
 */
const ES_COUNTRIES = [
  'ES', 'MX', 'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GQ', 'GT',
  'HN', 'NI', 'PA', 'PE', 'PH', 'PR', 'PY', 'SV', 'US', 'UY', 'VE',
];

/**
 * policy decides which valid forms ship (measured on Tatoeba held-out text,
 * see tools/freq/README.md):
 *   full            every form - fits for these languages (250k-610k words)
 *   seen-paradigms  every form of each lemma seen in use, the bare lemma of the
 *                   rest. Portuguese expands to 2.19M forms; this ships ~1M
 *   seen-suffixes   Turkish expands to 4.49M forms. Lemmas, every form seen in
 *                   use, and the 1000 most-used suffixes on lemmas seen in use
 */
export const HUNSPELL = {
  es: { files: ES_COUNTRIES.map((c) => `es/es_${c}`), policy: 'full', tatoeba: 'spa' },
  fr: { files: ['fr_FR/dictionaries/fr'], policy: 'full', tatoeba: 'fra' },
  nl: { files: ['nl_NL/nl_NL'], policy: 'full', tatoeba: 'nld' },
  'pt-BR': { files: ['pt_BR/pt_BR'], policy: 'seen-paradigms', tatoeba: 'por' },
  da: { files: ['da_DK/da_DK'], policy: 'full', tatoeba: 'dan' },
  // names: 'usage' - tr_TR has no capitalised entries at all; its names
  // (istanbul) are told apart by how people write them, see build-dict.mjs
  tr: { files: ['tr_TR/tr_TR'], policy: 'seen-suffixes', topSuffixes: 1000, names: 'usage', tatoeba: 'tur' },
};

function fetchCached(rel) {
  const dest = path.join(CACHE, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    console.log(`  downloading ${rel}`);
    execFileSync('curl', ['-sL', '--fail', '-m', '300', '-o', `${dest}.part`, `${RAW}/${rel}`], { stdio: 'inherit' });
    fs.renameSync(`${dest}.part`, dest);
  }
  return fs.readFileSync(dest, 'utf8');
}

/** Parsed .aff + .dic for every file of a language. */
export function loadHunspell(lang) {
  return HUNSPELL[lang].files.map((file) => {
    const aff = parseAff(fetchCached(`${file}.aff`));
    const entries = parseDic(fetchCached(`${file}.dic`), aff);
    return { file, aff, entries };
  });
}

/** Local paths of the downloaded files (the frequency tool hands them to Hunspell itself). */
export function cachedPath(rel) {
  fetchCached(rel);
  return path.join(CACHE, rel);
}

const LOWER = /^\p{Ll}+$/u;

/**
 * A generated form -> the dictionary key it becomes, or null. Lowercase only:
 * a capitalised entry is a name or an abbreviation (Madrid, RTVE), exactly the
 * words SCOWL's lowercase filter drops for English. No hyphen, no apostrophe
 * (l'homme, dá-lo): nobody can type those on the game's keyboard.
 */
export function formKey(form, lang) {
  if (!LOWER.test(form)) return null;
  const key = foldWord(form, lang);
  if (key === null) return null;
  const n = [...key].length;
  return n >= MIN_LEN && n <= MAX_LEN ? key : null;
}
