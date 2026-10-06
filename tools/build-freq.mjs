#!/usr/bin/env node
/**
 * One-off: freezes word frequencies from Tatoeba into tools/freq/<lang>.tsv.gz.
 *
 *   npm i --no-save hunspell-asm@4.0.2     # real Hunspell, compiled to WebAssembly
 *   node --max-old-space-size=8000 tools/build-freq.mjs [lang ...]
 *
 * Why frozen: Tatoeba re-exports every week, and a dictionary must rebuild
 * byte for byte (CI checks it, and the server replays rounds against the very
 * file the app shipped). So the counts are taken once, committed, and
 * tools/build-dict.mjs reads them.
 *
 * Each line is: key, times seen in lowercase, times seen capitalised
 * mid-sentence. Only lowercase sightings count as use: a capitalised word
 * mid-sentence is a name or a title ("Paris" says nothing about the French
 * word paris, "bets"), and a sentence's first word is ambiguous, so ignored.
 * The capitalised count is kept because Turkish needs it: tr_TR stores its
 * names in lowercase (istanbul), and a word people write only capitalised is
 * a name (tools/build-dict.mjs).
 *
 * Kept: every word that occurs in the sentences and that the dictionary
 * accepts - because the affix expansion generates it, or, for compounds
 * (Dutch hoofdstad, supermarkt), because real Hunspell accepts it AND it was
 * seen in lowercase, which keeps out names that happen to decompose into words.
 *
 * Tatoeba sentences: CC BY 2.0 FR, https://tatoeba.org - only counts are kept,
 * never a sentence. See tools/freq/README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { expand } from './hunspell.mjs';
import { HUNSPELL, LIBREOFFICE_COMMIT, loadHunspell, cachedPath, formKey } from './dict-sources.mjs';
import { PROFILES } from '../src/core/lang.ts';

const OUT = path.resolve('tools/freq');
const CACHE = path.join('.cache', 'tatoeba');

async function realHunspell() {
  try {
    const require = createRequire(path.resolve('package.json'));
    return await require('hunspell-asm').loadModule();
  } catch {
    throw new Error('hunspell-asm is missing: run "npm i --no-save hunspell-asm@4.0.2" first');
  }
}

function tatoeba(code) {
  const file = path.join(CACHE, `${code}_sentences.tsv.bz2`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const url = `https://downloads.tatoeba.org/exports/per_language/${code}/${code}_sentences.tsv.bz2`;
    console.log(`  downloading ${url}`);
    execFileSync('curl', ['-sL', '--fail', '-m', '600', '-o', file, url], { stdio: 'inherit' });
  }
  const bytes = fs.readFileSync(file);
  const text = execFileSync('bzcat', [file], { maxBuffer: 1 << 30 }).toString('utf8');
  return { text, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(HUNSPELL);
  const factory = await realHunspell();
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  manifest.libreofficeCommit = LIBREOFFICE_COMMIT;
  manifest.languages ??= {};

  for (const lang of langs) {
    const t0 = Date.now();
    const { locale } = PROFILES[lang];
    const expanded = new Set();
    for (const { aff, entries } of loadHunspell(lang)) {
      expand(aff, entries, (w) => { const k = formKey(w, lang); if (k) expanded.add(k); });
    }

    const src = tatoeba(HUNSPELL[lang].tatoeba);
    const lower = new Map();
    const capMid = new Map();
    const lowerSpelling = new Map();
    let sentences = 0;
    for (const line of src.text.split('\n')) {
      const text = line.split('\t')[2];
      if (!text) continue;
      sentences++;
      (text.normalize('NFC').match(/\p{L}+/gu) ?? []).forEach((tok, i) => {
        const low = tok.toLocaleLowerCase(locale);
        const k = formKey(low, lang);
        if (!k) return;
        if (tok === low) {
          lower.set(k, (lower.get(k) ?? 0) + 1);
          if (!lowerSpelling.has(k)) lowerSpelling.set(k, low);
        } else if (i > 0) {
          capMid.set(k, (capMid.get(k) ?? 0) + 1);
        }
      });
    }

    // compounds and anything else only Hunspell itself knows how to accept
    const primary = HUNSPELL[lang].files[0];
    const affPath = factory.mountBuffer(fs.readFileSync(cachedPath(`${primary}.aff`)), `${lang}.aff`);
    const dicPath = factory.mountBuffer(fs.readFileSync(cachedPath(`${primary}.dic`)), `${lang}.dic`);
    const h = factory.create(affPath, dicPath);
    let extras = 0;
    const keep = [];
    for (const k of new Set([...lower.keys(), ...capMid.keys()])) {
      const row = [k, lower.get(k) ?? 0, capMid.get(k) ?? 0];
      if (expanded.has(k)) { keep.push(row); continue; }
      const spelled = lowerSpelling.get(k);
      if (spelled && h.spell(spelled)) { keep.push(row); extras++; }
    }
    h.dispose();
    factory.unmount(affPath); factory.unmount(dicPath);

    keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const body = keep.map((r) => r.join('\t')).join('\n') + '\n';
    fs.writeFileSync(path.join(OUT, `${lang}.tsv.gz`), zlib.gzipSync(body, { level: 9 }));
    manifest.languages[lang] = {
      tatoeba: { file: `${HUNSPELL[lang].tatoeba}_sentences.tsv.bz2`, sha256: src.sha256, bytes: src.bytes, sentences },
      words: keep.length,
      seenLowercase: keep.filter(([, n]) => n >= 1).length,
      seenLowercaseTwice: keep.filter(([, n]) => n >= 2).length,
      compounds: extras,
    };
    console.log(`  ${lang.padEnd(6)} ${sentences} sentences -> ${keep.length} words (${extras} only Hunspell accepts), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
