#!/usr/bin/env node
/**
 * Builds public/dict/<lang>.kowd for every language the game is played in.
 *
 *   node tools/build-dict.mjs [lang ...]          (default: all)
 *
 * English: SCOWL (words + commonness tiers) and WordNet (category hints).
 * Everything else: LibreOffice's Hunspell dictionaries expanded to word forms
 * (tools/hunspell.mjs, sources in tools/dict-sources.mjs) with commonness from
 * the frozen Tatoeba counts in tools/freq/ (tools/build-freq.mjs).
 *
 * English sources and licences (both permit commercial use; notices ship in the Credits screen):
 *   SCOWL   - Copyright 2000-2011 Kevin Atkinson. "Permission to use, copy, modify,
 *             distribute and sell these word lists, the associated scripts, the output
 *             created from the scripts, and its documentation for any purpose is hereby
 *             granted without fee, provided that the above copyright notice appears..."
 *   WordNet - WordNet 3.0 Copyright 2006 by Princeton University. "Permission to use, copy,
 *             modify and distribute this software and database and its documentation for any
 *             purpose and without fee or royalty is hereby granted, provided that you agree
 *             to comply with the following copyright notice and statements..."
 *
 * Every output is byte-for-byte reproducible from the pinned inputs; CI builds
 * twice and compares hashes. The file layout is documented in tools/kowd.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { packKowd, sortKeys, TIERS, MIN_LEN, MAX_LEN } from './kowd.mjs';
import { expand, collectForbidden } from './hunspell.mjs';
import { HUNSPELL, loadHunspell, formKey } from './dict-sources.mjs';
import { LANGUAGES } from '../src/core/lang.ts';

export { TIERS };
export const CATEGORIES = [
  'animal', 'food', 'person', 'plant', 'body',
  'place', 'object', 'substance', 'time', 'communication',
];
// WordNet lexicographer file number -> index in CATEGORIES
const LEX_TO_CAT = { 5: 0, 13: 1, 18: 2, 20: 3, 8: 4, 15: 5, 6: 6, 27: 7, 28: 8, 10: 9 };

const CACHE = '.cache';
const SCOWL_URL = 'https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz';
const WORDNET_URL = 'https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz';
const MAX_TIER = 70;       // audit §4.3: 80 adds 126k obscure forms in one jump
const EN_EVERYDAY_MAX_TIER = 50;

/**
 * The English everyday pool, tier by tier, as SCOWL defines it. The other
 * languages are calibrated against it: their everyday words are spread over
 * the same tiers in the same proportions, and prompt bands scale with the
 * size of their everyday pool (bandScale). The English build asserts these.
 */
const EN_TIER_COUNTS = { 10: 3943, 20: 6920, 35: 28151, 40: 4670, 50: 17494 };
const EN_EVERYDAY = 61178;

/**
 * Elsewhere "everyday" means seen at least twice in Tatoeba; one sighting is
 * as likely a slip as a word people use. Every other valid word is tier 50 -
 * accepted at every difficulty, because no other language has SCOWL's split
 * between a standard dictionary and the obscure extras.
 */
const SEEN_EVERYDAY = 2;
const OTHER_EVERYDAY_MAX_TIER = 40;
const OTHER_REST_TIER = 50;

function fetchAndExtract(url, tarName, probePath) {
  fs.mkdirSync(CACHE, { recursive: true });
  if (fs.existsSync(path.join(CACHE, probePath))) return;
  const tgz = path.join(CACHE, tarName);
  if (!fs.existsSync(tgz)) {
    console.log(`  downloading ${url}`);
    execFileSync('curl', ['-sL', '--fail', '-m', '300', '-o', tgz, url], { stdio: 'inherit' });
  }
  execFileSync('tar', ['xzf', tgz, '-C', CACHE], { stdio: 'inherit' });
}

function readScowl() {
  const dir = path.join(CACHE, 'scowl-2020.12.07', 'final');
  const tierOf = new Map();
  for (const t of TIERS) {
    for (const f of [`english-words.${t}`, `american-words.${t}`]) {
      const p = path.join(dir, f);
      if (!fs.existsSync(p)) continue;
      for (const raw of fs.readFileSync(p, 'latin1').split('\n')) {
        const w = raw.trim().toLowerCase();
        if (w.length < MIN_LEN || w.length > MAX_LEN) continue;
        if (!/^[a-z]+$/.test(w)) continue;
        if (!tierOf.has(w)) tierOf.set(w, t);
      }
    }
    if (t >= MAX_TIER) break;
  }
  return tierOf;
}

function readWordNetCategories(tierOf) {
  const file = path.join(CACHE, 'dict', 'data.noun');
  const cat = new Map();
  for (const line of fs.readFileSync(file, 'latin1').split('\n')) {
    if (!/^\d{8} /.test(line)) continue;
    const p = line.split(' ');
    const lex = Number.parseInt(p[1], 10);
    const bit = LEX_TO_CAT[lex];
    if (bit === undefined) continue;
    const n = Number.parseInt(p[3], 16);
    for (let i = 0; i < n; i++) {
      const w = (p[4 + i * 2] || '').toLowerCase();
      if (tierOf.has(w)) cat.set(w, (cat.get(w) || 0) | (1 << bit));
    }
  }
  return cat;
}

function buildEnglish() {
  fetchAndExtract(SCOWL_URL, 'scowl.tar.gz', 'scowl-2020.12.07/final/english-words.10');
  fetchAndExtract(WORDNET_URL, 'wordnet.tar.gz', 'dict/data.noun');
  const tierOf = readScowl();
  const catOf = readWordNetCategories(tierOf);
  const words = sortKeys(tierOf.keys());

  const counts = {};
  for (const t of tierOf.values()) counts[t] = (counts[t] ?? 0) + 1;
  for (const [t, n] of Object.entries(EN_TIER_COUNTS)) {
    if (counts[t] !== n) throw new Error(`en: tier ${t} has ${counts[t]} words, calibration expects ${n}`);
  }
  const blob = packKowd({
    lang: 'en', words, tierOf: (w) => tierOf.get(w), maskOf: (w) => catOf.get(w) ?? 0,
    everydayMaxTier: EN_EVERYDAY_MAX_TIER, bandScale: 1000,
  });
  return { blob, words: words.length, everyday: EN_EVERYDAY, note: `categorised ${catOf.size}` };
}

/**
 * The frozen Tatoeba counts: `freq` holds lowercase sightings - use - and
 * `names` the words only ever written capitalised mid-sentence, at least
 * NAME_MIN_CAPITALISED times. tr_TR stores names in lowercase (istanbul,
 * antalya), so for Turkish that is the only way to tell a name from a word.
 */
const NAME_MIN_CAPITALISED = 3;
function readFreq(lang) {
  const file = path.resolve(`tools/freq/${lang}.tsv.gz`);
  if (!fs.existsSync(file)) throw new Error(`${file} missing - see tools/build-freq.mjs`);
  const freq = new Map();
  const names = new Set();
  for (const line of zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n')) {
    if (!line) continue;
    const [k, lower, cap] = line.split('\t');
    if (Number(lower) > 0) freq.set(k, Number(lower));
    else if (Number(cap) >= NAME_MIN_CAPITALISED) names.add(k);
  }
  return { freq, names };
}

/**
 * Turkish: lemmas, all seen forms, and the most-used suffixes on lemmas seen
 * in use. A lemma people only write capitalised is a name: it and every form
 * built on it are left out (measured at 261 lemmas - provinces, countries,
 * people - and a handful of words mostly seen inside names, like gaga).
 */
function seenSuffixes({ aff, entries }, lang, freq, names, top, keys) {
  if (aff.pfx.size > 0 || aff.needAffix !== null) throw new Error(`${lang}: seen-suffixes expects suffixes only`);
  const suffix = new Map();
  for (const [flag, cls] of aff.sfx) {
    const r = cls.rules[0];
    if (cls.rules.length !== 1 || r.strip || r.test || r.cont.size) {
      throw new Error(`${lang}: SFX ${flag} is not one plain suffix; seen-suffixes cannot be used`);
    }
    suffix.set(flag, r.add);
  }
  const forbidden = collectForbidden(aff, entries);
  const pop = new Map();
  const isName = entries.map((e) => names.has(formKey(e.word, lang)));
  const seen = entries.map((e, i) => {
    if (isName[i]) return false;
    const lemma = forbidden.has(e.word) ? null : formKey(e.word, lang);
    if (lemma) keys.add(lemma);
    let hit = lemma !== null && freq.has(lemma);
    for (const f of e.flags) {
      const s = suffix.get(f);
      if (s === undefined || forbidden.has(e.word + s)) continue;
      const k = formKey(e.word + s, lang);
      if (k && freq.has(k)) { hit = true; pop.set(f, (pop.get(f) ?? 0) + freq.get(k)); }
    }
    return hit;
  });
  // most used first; ties by flag so the choice is deterministic
  const ranked = [...pop].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const chosen = new Set(ranked.slice(0, top).map(([f]) => f));
  entries.forEach((e, i) => {
    if (!seen[i]) return;
    for (const f of e.flags) {
      if (!chosen.has(f) || forbidden.has(e.word + suffix.get(f))) continue;
      const k = formKey(e.word + suffix.get(f), lang);
      if (k) keys.add(k);
    }
  });
}

function buildHunspell(lang) {
  const cfg = HUNSPELL[lang];
  const { freq, names } = readFreq(lang);
  const keys = new Set();
  for (const src of loadHunspell(lang)) {
    const { aff, entries } = src;
    if (cfg.policy === 'full') {
      expand(aff, entries, (w) => { const k = formKey(w, lang); if (k) keys.add(k); });
    } else if (cfg.policy === 'seen-paradigms') {
      const forbidden = collectForbidden(aff, entries);
      for (const e of entries) {
        const forms = new Set();
        expand(aff, [e], (w) => { const k = formKey(w, lang); if (k) forms.add(k); }, forbidden);
        let seen = false;
        for (const f of forms) if (freq.has(f)) { seen = true; break; }
        if (seen) { for (const f of forms) keys.add(f); continue; }
        const lemma = formKey(e.word, lang);
        if (lemma && forms.has(lemma)) keys.add(lemma);
      }
    } else if (cfg.policy === 'seen-suffixes') {
      seenSuffixes(src, lang, freq, cfg.names === 'usage' ? names : new Set(), cfg.topSuffixes, keys);
    } else {
      throw new Error(`${lang}: unknown policy ${cfg.policy}`);
    }
  }
  // every word seen in use - including the compounds only Hunspell itself accepts
  for (const k of freq.keys()) keys.add(k);

  const everyday = [...keys].filter((k) => (freq.get(k) ?? 0) >= SEEN_EVERYDAY)
    .sort((a, b) => freq.get(b) - freq.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  const tier = new Map();
  const enPool = EN_EVERYDAY - EN_TIER_COUNTS[50];
  let i = 0;
  let cum = 0;
  for (const t of [10, 20, 35, 40]) {
    cum += EN_TIER_COUNTS[t];
    const end = t === 40 ? everyday.length : Math.round((everyday.length * cum) / enPool);
    for (; i < end; i++) tier.set(everyday[i], t);
  }
  const words = sortKeys(keys);
  const blob = packKowd({
    lang, words,
    tierOf: (w) => tier.get(w) ?? OTHER_REST_TIER,
    everydayMaxTier: OTHER_EVERYDAY_MAX_TIER,
    bandScale: Math.max(1, Math.round((1000 * everyday.length) / EN_EVERYDAY)),
  });
  return { blob, words: words.length, everyday: everyday.length, note: `${cfg.policy}` };
}

function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : [...LANGUAGES];
  fs.mkdirSync('public/dict', { recursive: true });
  for (const lang of langs) {
    if (!LANGUAGES.includes(lang)) throw new Error(`unknown language "${lang}"`);
    const t0 = Date.now();
    const { blob, words, everyday, note } = lang === 'en' ? buildEnglish() : buildHunspell(lang);
    const out = `public/dict/${lang}.kowd`;
    fs.writeFileSync(out, blob);
    const br = zlib.brotliCompressSync(blob, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
    const gz = zlib.gzipSync(blob, { level: 9 });
    console.log(
      `  ${lang.padEnd(6)} ${String(words).padStart(7)} words  ${String(everyday).padStart(6)} everyday  ` +
      `${(blob.length / 1e6).toFixed(2).padStart(5)} MB  gzip ${(gz.length / 1e6).toFixed(2)} MB  ` +
      `brotli ${(br.length / 1e6).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s  ` +
      `sha256 ${crypto.createHash('sha256').update(blob).digest('hex').slice(0, 16)}  (${note})`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
