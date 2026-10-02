/**
 * Writes every character sprite sheet in the game, from code.
 *
 *   node tools/build-sprites.mjs
 *
 * The drawing itself lives in tools/knight.mjs so the preview tooling can
 * import it without triggering a build. Nothing binary is committed: CI runs
 * this and the output is byte-identical, because the encoder is deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Px } from './pixel.mjs';
import { HOUSES, ANIMS, knightFrame, W, H } from './knight.mjs';

const OUT = path.resolve('public/sprites');

function sheet(house) {
  const names = Object.keys(ANIMS);
  const cols = Math.max(...names.map((n) => ANIMS[n].length));
  const out = new Px(W * cols, H * names.length);
  names.forEach((name, row) => {
    ANIMS[name].forEach((pose, col) => {
      out.blit(knightFrame(house, pose), col * W, row * H);
    });
  });
  return { px: out, rows: names, cols };
}

fs.mkdirSync(OUT, { recursive: true });
console.log('building sprites');

const manifest = { frame: { w: W, h: H }, anims: {}, houses: [] };
Object.keys(ANIMS).forEach((name, row) => {
  manifest.anims[name] = { row, frames: ANIMS[name].length, fps: name === 'idle' ? 6 : 12 };
});

let total = 0;
for (const [name, house] of Object.entries(HOUSES)) {
  const { px, rows, cols } = sheet(house);
  const png = px.png();
  fs.writeFileSync(path.join(OUT, `knight-${name}.png`), png);
  total += png.length;
  manifest.houses.push(name);
  console.log(
    `  knight-${name}.png`.padEnd(28),
    String(png.length).padStart(6),
    'bytes',
    `(${px.w}x${px.h}, ${rows.length} anims x ${cols} frames)`
  );
}

fs.writeFileSync(path.join(OUT, 'sprites.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`  ---\n  ${Object.keys(HOUSES).length} houses, ${(total / 1024).toFixed(1)} KB total`);
