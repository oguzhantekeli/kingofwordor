/**
 * A tiny pixel canvas + PNG encoder.
 *
 * Deliberately dependency-free: the sprite pipeline has to be reproducible
 * byte-for-byte on CI (tools/verify-assets.mjs hashes what it produces), and
 * every image encoder in npm is either native, non-deterministic, or both.
 * zlib is in Node, and an uncompressed-filter PNG is ~40 lines.
 */
import zlib from 'node:zlib';

// ---------------------------------------------------------------- colour

/** '#rgb' | '#rrggbb' | '#rrggbbaa' -> [r,g,b,a] */
export function rgba(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  return [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Mix two hex colours; t=0 is a, t=1 is b. Used to derive shade ramps. */
export function mix(a, b, t) {
  const [ar, ag, ab] = rgba(a);
  const [br, bg, bb] = rgba(b);
  const n = (x, y) => Math.round(x + (y - x) * t);
  return `#${[n(ar, br), n(ag, bg), n(ab, bb)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

// ---------------------------------------------------------------- canvas

export class Px {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 4);
  }

  set(x, y, colour) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof colour === 'string' ? rgba(colour) : colour;
    if (a === 0) return;
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255;
      return;
    }
    // source-over, so semi-transparent shadow passes read correctly
    const sa = a / 255;
    const da = this.d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    const c = (s, dst) => Math.round((s * sa + dst * da * (1 - sa)) / oa);
    this.d[i] = c(r, this.d[i]);
    this.d[i + 1] = c(g, this.d[i + 1]);
    this.d[i + 2] = c(b, this.d[i + 2]);
    this.d[i + 3] = Math.round(oa * 255);
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }

  rect(x, y, w, h, colour) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, colour);
  }

  /** Bresenham, with an optional width for sword blades. */
  line(x0, y0, x1, y1, colour, width = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (width === 1) this.set(x0, y0, colour);
      else this.rect(x0 - ((width / 2) | 0), y0 - ((width / 2) | 0), width, width, colour);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Rows of characters -> pixels, via a key map. ' ' and '.' are holes. */
  stamp(x, y, rows, key) {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        const c = key[ch];
        if (c) this.set(x + i, y + j, c);
      });
    });
  }

  /** Paint a 1px outline around every opaque pixel. What makes it read as a sprite. */
  outline(colour) {
    const copy = new Uint8Array(this.d);
    const opaque = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      return copy[(y * this.w + x) * 4 + 3] > 0;
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (opaque(x, y)) continue;
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
          this.set(x, y, colour);
        }
      }
    }
  }

  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) {
      for (let i = 0; i < src.w; i++) {
        const p = src.get(i, j);
        if (p[3] > 0) this.set(x + i, y + j, p);
      }
    }
  }

  /** Nearest-neighbour upscale. Pixel art must never be resampled smoothly. */
  scale(n) {
    const out = new Px(this.w * n, this.h * n);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const p = this.get(x, y);
        if (p[3] > 0) out.rect(x * n, y * n, n, n, p);
      }
    }
    return out;
  }

  png() {
    return encodePng(this.w, this.h, this.d);
  }
}

// ------------------------------------------------------------------- PNG

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none, so the bytes are the pixels
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
