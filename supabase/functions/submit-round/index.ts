/**
 * POST /functions/v1/submit-round
 *
 * Thin by design. Everything that decides whether a score is real lives in
 * src/core/verify.ts, which is unit-tested (13 tests, including forged scores,
 * bot-speed input and hand-picked daily seeds). This file only does HTTP,
 * auth and the database write.
 *
 *   1. resolve the caller from their JWT (anon callers are refused)
 *   2. replay their event log with the shared engine -> the server's score
 *   3. insert that score with the service role (RLS refuses client writes)
 *
 * Deploy: supabase functions deploy submit-round
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
 * provided by the platform; DICT_URL must be set to where the dictionaries are
 * served, with {lang} where the language goes:
 *   https://example.com/dict/{lang}.kowd
 * They must be the exact files the app ships (public/dict/*.kowd from the
 * same build), or honest rounds replay to different scores.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { buildGameData, type GameData } from '../../../src/core/load.ts';
import { verifyRound, type RoundSubmission } from '../../../src/core/verify.ts';
import { dayKey } from '../../../src/core/progress.ts';
import { isLang, type Lang } from '../../../src/core/lang.ts';

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DICT_URL = Deno.env.get('DICT_URL')!;

// Parsed once per language per warm instance, not per request. Only a
// language on the fixed list ever reaches the URL - the client cannot make
// this function fetch anything else.
const games = new Map<Lang, Promise<GameData>>();
function loadGame(lang: Lang): Promise<GameData> {
  let game = games.get(lang);
  if (!game) {
    game = fetch(DICT_URL.replace('{lang}', lang)).then(async (r) => {
      if (!r.ok) throw new Error(`dictionary ${lang} ${r.status}`);
      return buildGameData(await r.arrayBuffer());
    });
    game.catch(() => games.delete(lang)); // a failed fetch is retried next time
    games.set(lang, game);
  }
  return game;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
  const { data: who, error: authErr } = await asUser.auth.getUser();
  if (authErr || !who.user) return json(401, { error: 'sign in to post a score' });

  let sub: RoundSubmission;
  try {
    sub = (await req.json()) as RoundSubmission;
  } catch {
    return json(400, { error: 'body is not JSON' });
  }

  // rounds from clients older than the language picker carry no lang: English
  const lang = sub.lang ?? 'en';
  if (!isLang(lang)) return json(422, { ok: false, score: 0, reasons: [`unknown language ${String(lang)}`] });
  const g = await loadGame(lang);
  const now = new Date();
  const verdict = verifyRound(sub, { ...g, now, today: dayKey(now) });
  if (!verdict.ok) return json(422, { ok: false, score: 0, reasons: verdict.reasons });

  const admin = createClient(URL_, SERVICE);
  const { error } = await admin.from('rounds').insert({
    user_id: who.user.id,
    lang,
    mode: sub.mode,
    day: sub.mode === 'daily' ? sub.day : null,
    difficulty: sub.difficulty,
    seed: sub.seed,
    score: verdict.score,
    words: verdict.words,
    claimed_score: sub.claimedScore,
    mismatch: verdict.mismatch,
    events: sub.events,
  });
  // 23505 = unique_violation: the one-daily-per-day index caught a replay
  if (error) return json(error.code === '23505' ? 409 : 500, { ok: false, score: 0, reasons: [error.message] });

  return json(200, { ok: true, score: verdict.score, reasons: verdict.reasons });
});
