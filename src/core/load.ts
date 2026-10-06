import { Dictionary } from './dictionary';
import { buildPromptPools, type PromptPools } from './rules';
import type { Category } from './types';

export interface GameData {
  dict: Dictionary;
  pools: PromptPools;
  viability: ReadonlyMap<string, readonly Category[]>;
}

/**
 * Load and index a packed dictionary. One pass over its bytes - offsets,
 * prompt statistics and category viability together; do it once per
 * language, never per round.
 */
export async function loadGameData(url: string, fetchImpl = fetch): Promise<GameData> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status} ${res.statusText}`);
  return buildGameData(await res.arrayBuffer());
}

export function buildGameData(buffer: ArrayBuffer): GameData {
  const dict = Dictionary.parse(buffer);
  return { dict, pools: buildPromptPools(dict), viability: dict.viability };
}
