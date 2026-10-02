import type { SupabaseClient } from '@supabase/supabase-js';

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
