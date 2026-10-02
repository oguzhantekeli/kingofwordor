import fs from 'node:fs';
import path from 'node:path';
import { buildGameData, type GameData } from '../load';

const KOWD = path.resolve('public/dict/en.kowd');

let cached: GameData | null = null;

/** The real shipped dictionary. Built once, shared across specs. */
export function gameData(): GameData {
  if (!cached) {
    if (!fs.existsSync(KOWD)) {
      throw new Error(`${KOWD} missing - run "npm run build:dict" first`);
    }
    const buf = fs.readFileSync(KOWD);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    cached = buildGameData(ab as ArrayBuffer);
  }
  return cached;
}
