import fs from 'node:fs';
import path from 'node:path';
import { buildGameData, type GameData } from '../load';
import type { Lang } from '../lang';

const cache = new Map<Lang, GameData>();

/** A real shipped dictionary. Built once per language, shared across specs. */
export function gameDataFor(lang: Lang): GameData {
  let data = cache.get(lang);
  if (!data) {
    const file = path.resolve(`public/dict/${lang}.kowd`);
    if (!fs.existsSync(file)) {
      throw new Error(`${file} missing - run "npm run build:dict" first`);
    }
    const buf = fs.readFileSync(file);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    data = buildGameData(ab as ArrayBuffer);
    cache.set(lang, data);
  }
  return data;
}

/** The English dictionary - what every pre-language spec was written against. */
export function gameData(): GameData {
  return gameDataFor('en');
}
