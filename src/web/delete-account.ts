/**
 * The web deletion page Google Play's User Data policy requires: a player who
 * has uninstalled the app can still delete their account and data here, with
 * no reinstall. Verified requirement text: the page must load without error,
 * feature the deletion path prominently, name the app and developer as on the
 * store listing, and work "without sending the user back to the app".
 */
import './delete-account.css';
import type { SupabaseClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const DEVELOPER = (import.meta.env.VITE_DEVELOPER_NAME as string | undefined) ?? '';
const EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? '';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const flow = $('flow');

$('developer').textContent = DEVELOPER || 'the developer';
if (EMAIL) {
  const a = $<HTMLAnchorElement>('email-link');
  a.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Delete my King of Wordor account')}`;
  a.textContent = EMAIL;
  $('email-section').hidden = false;
}

function show(html: string): void {
  flow.innerHTML = html;
}

async function client(): Promise<SupabaseClient | null> {
  if (!URL_ || !KEY) return null;
  const { createClient } = await import('@supabase/supabase-js');
  // detectSessionInUrl: this page IS the OAuth redirect target, unlike the app
  return createClient(URL_, KEY, { auth: { detectSessionInUrl: true, persistSession: false } });
}

async function main(): Promise<void> {
  const sb = await client();
  if (!sb) {
    show(`<p class="del-warn">Online deletion is not available yet.${EMAIL ? ' Please use the email option below.' : ''}</p>`);
    return;
  }
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    show(`<button type="button" class="del-btn" id="signin">Sign in with Google</button>`);
    $('signin').addEventListener('click', () => {
      void sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    });
    return;
  }

  const name = (user.user_metadata as { full_name?: string })?.full_name ?? user.email ?? 'your account';
  const p = document.createElement('p');
  p.textContent = `Signed in as ${name}. This permanently deletes the account and everything listed above.`;
  flow.replaceChildren(p);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'del-btn del-btn--danger';
  btn.textContent = 'Delete my account permanently';
  flow.append(btn);

  btn.addEventListener('click', async () => {
    if (!window.confirm('Delete your King of Wordor account and all its data? This cannot be undone.')) return;
    btn.disabled = true;
    const { error } = await sb.rpc('delete_my_account');
    if (error) {
      show(`<p class="del-warn" role="alert">Deletion failed. Nothing was removed. Please try again${EMAIL ? ' or email us' : ''}.</p>`);
      return;
    }
    await sb.auth.signOut();
    show(`<p class="del-done" role="status">Your account and its data have been deleted.</p>`);
  });
}

void main().catch(() => show('<p class="del-warn" role="alert">Something went wrong loading this page. Please reload.</p>'));
