import { Dictionary } from './dictionary';
import { buildCategoryViability, buildPromptPools, type PromptPools } from './rules';
import type { Category } from './types';

export interface GameData {
  dict: Dictionary;
  pools: PromptPools;
  viability: ReadonlyMap<string, readonly Category[]>;
  words: readonly string[];
}

/**
 * Load and index the packed dictionary. Measured at ~30 ms for 110k words
 * (plan §4.3); do it once at boot, never per round.
 */
export async function loadGameData(url: string, fetchImpl = fetch): Promise<GameData> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status} ${res.statusText}`);
  return buildGameData(await res.arrayBuffer());
}

export function buildGameData(buffer: ArrayBuffer): GameData {
  const dict = Dictionary.parse(buffer);
  const words = wordsOf(buffer);
  return {
    dict,
    pools: buildPromptPools(dict),
    viability: buildCategoryViability(dict, words),
    words,
  };
}

function wordsOf(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const count = view.getUint32(8, true);
  const textOff = 16 + Math.ceil(count / 2) + count * 2;
  return new TextDecoder().decode(bytes.subarray(textOff)).split('\n');
}
