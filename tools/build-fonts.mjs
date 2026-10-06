/**
 * Bundles the UI fonts into the app.
 *
 *   node tools/build-fonts.mjs
 *
 * The app previously pulled Silkscreen and Outfit from fonts.googleapis.com at
 * runtime. In a packaged Android app that is wrong twice over: the display face
 * silently falls back to a system serif on a cold or offline first launch, and
 * every launch hands a user's IP to a third party, which is a consent question
 * in the EU. So the woff2 files ship inside the APK.
 *
 * Fetches the same css2 endpoint a browser would, keeps the latin and
 * latin-ext subsets of each face, and writes src/ui/theme/fonts.css with local
 * @font-face rules. latin-ext carries the Turkish ğ ş İ (U+011E-015F) that
 * latin lacks; its unicode-range means a browser only loads it when a page
 * actually contains one of those characters.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('public/fonts');
const CSS_OUT = path.resolve('src/ui/theme/fonts.css');

// A modern UA, or the API serves truetype for ancient browsers instead of woff2.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FAMILIES = [
  { family: 'Silkscreen', weights: [400, 700] },
  { family: 'Outfit', weights: [400, 600, 700] },
];

/** latin covers U+0041 (A); latin-ext starts at U+0100. Cyrillic, Greek and Vietnamese are never rendered. */
function subsetOf(range) {
  if (/U\+0000-00FF/.test(range)) return 'latin';
  if (range.startsWith('U+0100-')) return 'latin-ext';
  return null;
}

function parseFaces(css) {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
    const get = (k) => (body.match(new RegExp(`${k}:\\s*([^;]+);`)) || [])[1]?.trim();
    return {
      family: (get('font-family') || '').replace(/['"]/g, ''),
      weight: get('font-weight') || '400',
      style: get('font-style') || 'normal',
      range: get('unicode-range') || '',
      url: (get('src') || '').match(/url\((https:[^)]+)\)/)?.[1] || '',
    };
  });
}

console.log('building fonts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const rules = [];
let total = 0;

for (const { family, weights } of FAMILIES) {
  const spec = `${family.replace(/ /g, '+')}:wght@${weights.join(';')}`;
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`${family}: css2 returned ${res.status}`);
  const faces = parseFaces(await res.text()).filter((f) => f.url && subsetOf(f.range));

  // A variable family serves ONE file for every weight. Writing it once per
  // weight would ship the same 32 KB three times, so group by url first.
  const byUrl = new Map();
  for (const subset of ['latin', 'latin-ext']) {
    for (const weight of weights) {
      const face = faces.find((f) => subsetOf(f.range) === subset &&
        (f.weight === String(weight) || f.weight.split(' ').includes(String(weight))));
      if (!face) throw new Error(`${family} ${weight}: no ${subset} face in the css2 response`);
      if (!byUrl.has(face.url)) byUrl.set(face.url, { subset, range: face.range, ws: [] });
      byUrl.get(face.url).ws.push(weight);
    }
  }

  for (const [url, { subset, range, ws }] of byUrl) {
    const variable = ws.length > 1;
    const file = `${family.toLowerCase()}-${variable ? 'var' : ws[0]}${subset === 'latin-ext' ? '-ext' : ''}.woff2`;
    const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, file), bytes);
    total += bytes.length;
    console.log(`  ${file.padEnd(28)} ${String(bytes.length).padStart(6)} bytes  (${subset}, weight ${ws.join(', ')})`);
    rules.push(
      `@font-face {\n` +
      `  font-family: '${family}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${variable ? `${Math.min(...ws)} ${Math.max(...ws)}` : ws[0]};\n` +
      `  font-display: swap;\n` +
      `  src: url('/fonts/${file}') format('woff2');\n` +
      `  unicode-range: ${range};\n` +
      `}`
    );
  }
}

// Silkscreen has no Ğ ğ Ş ş İ ı (measured from its cmap: tools/woff2-cmap.mjs).
// "Silkscreen TR" draws them on its pixel grid - built once by
// tools/build-silkscreen-tr.py (OFL, licence in tools/fonts/) and copied here.
// Its unicode-range is exactly its 7 characters; tokens.css decides where in
// the stack it sits (first only under :lang(tr), for the dotted i).
const TR_RANGE = 'U+0069, U+011E-011F, U+0130-0131, U+015E-015F';
for (const weight of [400, 700]) {
  const file = `silkscreen-tr-${weight}.woff2`;
  const bytes = fs.readFileSync(path.resolve('tools/fonts', file));
  fs.writeFileSync(path.join(OUT_DIR, file), bytes);
  total += bytes.length;
  console.log(`  ${file.padEnd(28)} ${String(bytes.length).padStart(6)} bytes  (Turkish supplement, weight ${weight})`);
  rules.push(
    `@font-face {\n` +
    `  font-family: 'Silkscreen TR';\n` +
    `  font-style: normal;\n` +
    `  font-weight: ${weight};\n` +
    `  font-display: swap;\n` +
    `  src: url('/fonts/${file}') format('woff2');\n` +
    `  unicode-range: ${TR_RANGE};\n` +
    `}`
  );
}

fs.writeFileSync(
  CSS_OUT,
  '/* Generated by tools/build-fonts.mjs. Do not edit: run `npm run build:fonts`. */\n' +
    rules.join('\n\n') +
    '\n'
);
console.log(`  ---\n  ${rules.length} faces, ${(total / 1024).toFixed(1)} KB -> src/ui/theme/fonts.css`);
