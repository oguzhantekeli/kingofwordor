/**
 * The .kowd container (format 2), written by every dictionary build and read by
 * src/core/dictionary.ts. Little-endian; every section indexed by word ordinal.
 *
 *   0   u8[4]  magic "KOWD"
 *   4   u32    format version (2)
 *   8   u32    wordCount
 *   12  u32    textByteLength
 *   16  u8[8]  language tag, ASCII, NUL-padded ("en", "pt-BR")
 *   24  u8     everydayMaxTier: words at or below it are "everyday" - the
 *              pool prompt difficulty is measured on
 *   25  u8     flags: bit 0 = category masks present
 *   26  u16    bandScale: prompt band thresholds x bandScale / 1000
 *   28  u32    reserved, 0
 *   32  u8[]   tier nibbles, 4 bits/word, index into TIERS
 *       u16[]  category masks, 1 bit per CATEGORIES entry (only with flag bit 0)
 *       u8[]   words: strictly ascending by UTF-8 bytes, '\n'-joined
 *
 * Format 1 had no language: an English-only file with no way to say otherwise.
 */
import { foldWord, isLang } from '../src/core/lang.ts';

export const FORMAT_VERSION = 2;
export const HEADER_BYTES = 32;
export const TIERS = [10, 20, 35, 40, 50, 55, 60, 70];
export const MIN_LEN = 3;
export const MAX_LEN = 15;

export function packKowd({ lang, words, tierOf, maskOf = null, everydayMaxTier, bandScale }) {
  if (!isLang(lang)) throw new Error(`kowd: unsupported language "${lang}"`);
  if (!TIERS.includes(everydayMaxTier)) throw new Error(`kowd: everydayMaxTier ${everydayMaxTier}`);
  if (!Number.isInteger(bandScale) || bandScale < 1 || bandScale > 0xffff) throw new Error(`kowd: bandScale ${bandScale}`);

  const encoded = words.map((w) => Buffer.from(w, 'utf8'));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // the reader binary-searches, so order and uniqueness are part of the format
    if (i > 0 && Buffer.compare(encoded[i - 1], encoded[i]) >= 0) {
      throw new Error(`kowd: "${words[i - 1]}" is not strictly before "${w}"`);
    }
    if (foldWord(w, lang) !== w) throw new Error(`kowd: "${w}" is not a ${lang} dictionary key`);
    const len = [...w].length;
    if (len < MIN_LEN || len > MAX_LEN) throw new Error(`kowd: "${w}" has ${len} letters`);
  }

  const text = Buffer.from(words.join('\n'), 'utf8');
  const tiers = Buffer.alloc(Math.ceil(words.length / 2));
  const masks = maskOf ? Buffer.alloc(words.length * 2) : Buffer.alloc(0);
  words.forEach((w, i) => {
    const v = TIERS.indexOf(tierOf(w));
    if (v < 0) throw new Error(`kowd: word "${w}" has no tier`);
    tiers[i >> 1] |= i % 2 === 0 ? v : v << 4;
    if (maskOf) masks.writeUInt16LE(maskOf(w) ?? 0, i * 2);
  });

  const header = Buffer.alloc(HEADER_BYTES);
  header.write('KOWD', 0, 'ascii');
  header.writeUInt32LE(FORMAT_VERSION, 4);
  header.writeUInt32LE(words.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.write(lang, 16, 8, 'ascii');
  header.writeUInt8(everydayMaxTier, 24);
  header.writeUInt8(maskOf ? 1 : 0, 25);
  header.writeUInt16LE(bandScale, 26);
  return Buffer.concat([header, tiers, masks, text]);
}

/**
 * UTF-8 byte order - the order the reader's binary search assumes. For text
 * without surrogate pairs (every alphabet here is in the BMP) that is exactly
 * JavaScript's default code-unit order; packKowd re-checks every pair anyway.
 */
export function sortKeys(keys) {
  return [...keys].sort();
}
