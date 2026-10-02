import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGameData, loadGameData } from '../load';

const blob = (): ArrayBuffer => {
  const buf = fs.readFileSync(path.resolve('public/dict/en.kowd'));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe('loadGameData', () => {
  it('loads over a fetch-like interface', async () => {
    const fake = async () =>
      ({ ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => blob() }) as Response;
    const data = await loadGameData('/dict/en.kowd', fake);
    expect(data.dict.size).toBe(110248);
    expect(data.words.length).toBe(110248);
    expect(Object.keys(data.pools.byBand)).toHaveLength(5);
  });

  it('throws a useful error when the fetch fails', async () => {
    const fake = async () =>
      ({ ok: false, status: 503, statusText: 'Service Unavailable' }) as Response;
    await expect(loadGameData('/dict/en.kowd', fake)).rejects.toThrow(
      /dictionary fetch failed: 503 Service Unavailable/
    );
  });

  it('builds identical data from the same buffer', () => {
    const a = buildGameData(blob());
    const b = buildGameData(blob());
    expect(a.dict.size).toBe(b.dict.size);
    expect(a.dict.maxEverydayCount()).toBe(b.dict.maxEverydayCount());
  });
});
