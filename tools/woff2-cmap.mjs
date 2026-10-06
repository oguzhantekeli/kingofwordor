/**
 * Which characters a .woff2 font actually has glyphs for - read from its cmap.
 *
 * A face's unicode-range only says which characters the browser should ASK it
 * for; whether a glyph exists is in the cmap. Silkscreen's latin range lists
 * U+2212 and the font has no glyph for it - so coverage is checked here, from
 * the font itself (W3C WOFF 2.0, https://www.w3.org/TR/WOFF2/).
 *
 * WOFF2 stores every table in one Brotli stream, in directory order, without
 * padding. Only glyf, loca and hmtx can be transformed, so cmap's bytes come
 * out exactly as in the original font.
 */
import zlib from 'node:zlib';

const GLYF = 10;
const LOCA = 11;
const CMAP = 0;

function base128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.at++];
    v = v * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) return v;
  }
  throw new Error('woff2: bad UIntBase128');
}

function cmapTable(buf) {
  if (buf.readUInt32BE(0) !== 0x774f4632) throw new Error('woff2: bad signature');
  const numTables = buf.readUInt16BE(12);
  const compressed = buf.readUInt32BE(20);
  const pos = { at: 48 };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.at++];
    const tag = flags & 0x3f;
    if (tag === 63) pos.at += 4;
    const version = flags >> 6;
    const origLength = base128(buf, pos);
    // glyf/loca: version 0 IS the transform; every other table: version 0 is none
    const transformed = tag === GLYF || tag === LOCA ? version !== 3 : version !== 0;
    const length = transformed ? base128(buf, pos) : origLength;
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos.at, pos.at + compressed));
  let off = 0;
  for (const t of tables) {
    if (t.tag === CMAP) return data.subarray(off, off + t.length);
    off += t.length;
  }
  throw new Error('woff2: no cmap table');
}

/** The set of code points with a real glyph (glyph id != 0). */
export function woff2CodePoints(buf) {
  const cmap = cmapTable(buf);
  const records = [];
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const r = 4 + i * 8;
    records.push({ platform: cmap.readUInt16BE(r), encoding: cmap.readUInt16BE(r + 2), offset: cmap.readUInt32BE(r + 4) });
  }
  const out = new Set();
  for (const { platform, encoding, offset } of records) {
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = cmap.readUInt16BE(offset);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(offset + 6);
      const ends = offset + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2; s += 2) {
        const end = cmap.readUInt16BE(ends + s);
        const start = cmap.readUInt16BE(starts + s);
        const delta = cmap.readInt16BE(deltas + s);
        const range = cmap.readUInt16BE(ranges + s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph;
          if (range === 0) glyph = (c + delta) & 0xffff;
          else {
            const g = cmap.readUInt16BE(ranges + s + range + (c - start) * 2);
            glyph = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12);
      for (let g = 0; g < groups; g++) {
        const r = offset + 16 + g * 12;
        const start = cmap.readUInt32BE(r);
        const end = cmap.readUInt32BE(r + 4);
        const glyph = cmap.readUInt32BE(r + 8);
        for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c);
      }
    }
  }
  return out;
}
