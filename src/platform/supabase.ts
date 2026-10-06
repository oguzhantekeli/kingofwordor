import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoundSubmission } from '../core/verify';
import type { Lang } from '../core/lang';

/**
 * The Supabase client, created on first use.
 *
 * Both values are public by design: the anon key is shipped in the APK and
 * every request it makes is still subject to row level security. The
 * service_role key is the opposite and must never reach this file.
 *
 * The client is dynamically imported so the 100 KB SDK stays out of the first
 * paint - a guest who never signs in never downloads it.
 */
let client: SupabaseClient | null = null;

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured yet`);
    this.name = 'NotConfiguredError';
  }
}

export function isConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function supabase(): Promise<SupabaseClient> {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new NotConfiguredError('Supabase');

  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url, key, {
    auth: {
      // The app opens from a native shell, never from a redirect URL.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}

/**
 * Native Google sign-in.
 *
 * The flow is: @capgo/capacitor-social-login returns a Google idToken, which
 * Supabase exchanges via signInWithIdToken. That needs a Web OAuth client id
 * (passed as webClientId - never the Android one) and an Android OAuth client
 * registered against the package name and signing SHA-1.
 *
 * Until VITE_GOOGLE_WEB_CLIENT_ID exists this throws a typed error, and the UI
 * says so plainly instead of failing silently at the Google sheet.
 */
export async function signInWithGoogle(): Promise<{ id: string; name?: string | undefined }> {
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new NotConfiguredError('Google sign-in');

  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  // webClientId, not the Android one: the id token is minted for the web client
  // and that is the audience Supabase validates against.
  await SocialLogin.initialize({ google: { webClientId } });
  const { result } = await SocialLogin.login({ provider: 'google', options: {} });

  // The response is a union. Offline mode returns a serverAuthCode and no token
  // at all, and even online mode types idToken as nullable, so neither can be
  // assumed - a blind cast here would fail at runtime, not at compile time.
  if (result.responseType !== 'online') {
    throw new Error(`Google returned a ${result.responseType} response; expected an id token`);
  }
  const idToken = result.idToken;
  if (!idToken) throw new Error('Google returned no idToken');

  const sb = await supabase();
  const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase returned no user');

  const meta = data.user.user_metadata as { full_name?: string; name?: string } | undefined;
  return { id: data.user.id, name: meta?.full_name ?? meta?.name ?? result.profile.name ?? undefined };
}

// --------------------------------------------------------------- the ladder

export type Period = 'day' | 'week' | 'month' | 'year';

export interface LadderRow {
  rank: number;
  name: string;
  house: string;
  score: number;
  sieges: number;
  isMe: boolean;
}

export interface Posted {
  ok: boolean;
  /** The server's own score from its replay - the only one that counts. */
  score: number;
  reasons: string[];
}

/**
 * Send a finished round for server-side verification. The client sends what
 * happened (seed + events); the submit-round function replays it and stores its
 * own score. A score the client computed is never trusted - see core/verify.ts.
 */
export async function submitRound(sub: RoundSubmission): Promise<Posted> {
  const sb = await supabase();
  const { data, error } = await sb.functions.invoke<Posted>('submit-round', { body: sub });
  if (error) throw error;
  if (!data) throw new Error('submit-round returned nothing');
  return data;
}

/** The four ladders from the brief, one set per language. Public: anon may read them. */
export async function fetchLeaderboard(
  period: Period, anchor: string, lim = 50, lang: Lang = 'en'
): Promise<LadderRow[]> {
  const sb = await supabase();
  const { data, error } = await sb.rpc('leaderboard', { period, anchor, lim, lang });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    rank: Number(r.rank), name: String(r.name), house: String(r.house),
    score: Number(r.score), sieges: Number(r.sieges), isMe: r.is_me === true,
  }));
}

/** Google Play User Data policy: in-app deletion of the account and its data. */
export async function deleteAccount(): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  await sb.auth.signOut();
}

/** End the server session too - the client persists sessions across launches. */
export async function signOutEverywhere(): Promise<void> {
  if (!isConfigured()) return;
  const sb = await supabase();
  await sb.auth.signOut();
}
