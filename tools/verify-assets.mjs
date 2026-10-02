#!/usr/bin/env node
/**
 * Asset integrity gate. The audited app shipped 12 files with .jpg/.png
 * extensions whose contents were S3 "Access Denied" XML error pages, served in
 * production as image/jpeg. This check makes that impossible to repeat.
 *
 * Every asset must:
 *   1. exist,
 *   2. start with the magic bytes its extension claims,
 *   3. exceed a plausible minimum size,
 *   4. be referenced somewhere in src/ or index.html.
 *
 * Audio is additionally checked for CONTENT reproducibility by decoding to PCM
 * and hashing that - the Ogg container embeds a random bitstream serial, so a
 * raw byte hash is not stable across runs and would be a false alarm.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const MAGIC = {
  '.png': [0x89, 0x50, 0x4e, 0x47],
  '.opus': [0x4f, 0x67, 0x67, 0x53], // "OggS"
  '.svg': null,                       // text; checked separately
  '.kowd': [0x4b, 0x4f, 0x57, 0x44], // "KOWD"
};
const MIN_BYTES = { '.png': 300, '.opus': 400, '.svg': 200, '.kowd': 100_000 };

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

function sourceText() {
  const files = [...walk('src'), 'index.html'].filter((f) => fs.existsSync(f));
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

const failures = [];
const assets = walk('public').filter((f) => MIN_BYTES[path.extname(f)] !== undefined);
const refs = sourceText();

if (assets.length === 0) failures.push('no assets found under public/ - did the build tools run?');

for (const file of assets) {
  const ext = path.extname(file);
  const buf = fs.readFileSync(file);
  const rel = '/' + path.relative('public', file).split(path.sep).join('/');

  if (buf.length < MIN_BYTES[ext]) {
    failures.push(`${file}: only ${buf.length} bytes (min ${MIN_BYTES[ext]}) - truncated or an error page?`);
    continue;
  }
  const magic = MAGIC[ext];
  if (magic) {
    const ok = magic.every((b, i) => buf[i] === b);
    if (!ok) {
      const head = buf.subarray(0, 48).toString('utf8').replace(/\s+/g, ' ');
      failures.push(`${file}: wrong magic bytes for ${ext} - starts with "${head}"`);
      continue;
    }
  } else if (ext === '.svg') {
    const head = buf.subarray(0, 200).toString('utf8');
    if (!head.includes('<svg')) failures.push(`${file}: not an SVG - starts with "${head.slice(0, 40)}"`);
  }
  if (buf.subarray(0, 200).toString('utf8').includes('<Error>')) {
    failures.push(`${file}: contains an XML <Error> body - this is a failed download, not an asset`);
  }
  // A file counts as referenced when its path appears literally, or when the
  // static prefix of a generated family does - the knight sheets are reached as
  // `sprites/knight-${house}.png`, so no literal filename is ever in the source.
  const base = path.basename(file);
  // The leading slash is dropped too: a path built on import.meta.env.BASE_URL
  // is written `${BASE_URL}sprites/knight-`, with no slash of its own.
  const family = base.includes('-') ? rel.slice(1, rel.lastIndexOf('-') + 1) : null;
  const referenced =
    refs.includes(rel) ||
    refs.includes(rel.slice(1)) ||
    refs.includes(base) ||
    (family !== null && refs.includes(family));
  if (!referenced) {
    failures.push(`${file}: never referenced from src/ or index.html`);
  }
  console.log(`  ok  ${rel.padEnd(34)} ${String(buf.length).padStart(7)} bytes`);
}

// content-level reproducibility for audio
const ffmpeg = require('ffmpeg-static');
if (ffmpeg && fs.existsSync(ffmpeg)) {
  console.log('  --- audio content hashes (stable across rebuilds):');
  for (const file of assets.filter((f) => f.endsWith('.opus'))) {
    const pcm = execFileSync(ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 's16le', '-'],
      { maxBuffer: 64 * 1024 * 1024 });
    const hash = crypto.createHash('sha256').update(pcm).digest('hex').slice(0, 16);
    console.log(`  pcm ${path.basename(file).padEnd(16)} ${hash}  ${pcm.length} samples*2`);
  }
}

if (failures.length > 0) {
  console.error('\nASSET INTEGRITY FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`\nall ${assets.length} assets verified`);
