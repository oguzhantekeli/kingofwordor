#!/usr/bin/env node
/**
 * Builds public/dict/<lang>.kowd from SCOWL + WordNet.
 *
 * Sources and licences (both permit commercial use; notices ship in the Credits screen):
 *   SCOWL   - Copyright 2000-2011 Kevin Atkinson. "Permission to use, copy, modify,
 *             distribute and sell these word lists, the associated scripts, the output
 *             created from the scripts, and its documentation for any purpose is hereby
 *             granted without fee, provided that the above copyright notice appears..."
 *   WordNet - WordNet 3.0 Copyright 2006 by Princeton University. "Permission to use, copy,
 *             modify and distribute this software and database and its documentation for any
 *             purpose and without fee or royalty is hereby granted, provided that you agree
 *             to comply with the following copyright notice and statements..."
 *
 * Binary layout (little-endian), all sections indexed by the same word ordinal:
 *   0   u8[4]  magic "KOWD"
 *   4   u32    format version
 *   8   u32    wordCount
 *   12  u32    textByteLength
 *   16  u8[]   tier nibbles   - 4 bits/word, index into TIERS
 *       u16[]  category mask  - 1 bit per CATEGORIES entry
 *       u8[]   words          - sorted, '\n'-joined, UTF-8
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

export const TIERS = [10, 20, 35, 40, 50, 55, 60, 70];
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
const MIN_LEN = 3;
const MAX_LEN = 15;

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

export function pack(words, tierOf, catOf) {
  const text = Buffer.from(words.join('\n'), 'utf8');
  const tiers = Buffer.alloc(Math.ceil(words.length / 2));
  const masks = Buffer.alloc(words.length * 2);
  words.forEach((w, i) => {
    const v = TIERS.indexOf(tierOf.get(w));
    if (v < 0) throw new Error(`word "${w}" has no tier`);
    if (i % 2 === 0) tiers[i >> 1] |= v;
    else tiers[i >> 1] |= v << 4;
    masks.writeUInt16LE(catOf.get(w) || 0, i * 2);
  });
  const header = Buffer.alloc(16);
  header.write('KOWD', 0, 'ascii');
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(words.length, 8);
  header.writeUInt32LE(text.length, 12);
  return Buffer.concat([header, tiers, masks, text]);
}

function main() {
  console.log('building en.kowd');
  fetchAndExtract(SCOWL_URL, 'scowl.tar.gz', 'scowl-2020.12.07/final/english-words.10');
  fetchAndExtract(WORDNET_URL, 'wordnet.tar.gz', 'dict/data.noun');

  const tierOf = readScowl();
  const catOf = readWordNetCategories(tierOf);
  const words = [...tierOf.keys()].sort();
  const blob = pack(words, tierOf, catOf);

  fs.mkdirSync('public/dict', { recursive: true });
  fs.writeFileSync('public/dict/en.kowd', blob);
  const br = zlib.brotliCompressSync(blob, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  console.log(`  words        ${words.length}`);
  console.log(`  categorised  ${catOf.size} (${((catOf.size / words.length) * 100).toFixed(0)}%)`);
  console.log(`  blob         ${blob.length} bytes (${(blob.length / 1024).toFixed(0)} KB)`);
  console.log(`  brotli       ${br.length} bytes (${(br.length / 1024).toFixed(0)} KB)`);
  console.log(`  sha256       ${execFileSync('sha256sum', ['public/dict/en.kowd']).toString().split(' ')[0]}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
