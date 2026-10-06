/**
 * The language picker, through the real UI: switching changes the menus, the
 * dictionary, the keyboard and html lang together, and a word typed the way a
 * Turkish player types it (capitals, dotted İ) scores.
 */
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import App from '../App';
import { RESOURCES } from '../i18n';
import { useGame } from '../store/gameStore';
import { useSession } from '../store/sessionStore';
import { useSettings } from '../store/settingsStore';
import { matchesRule } from '../core/dictionary';
import { LANGUAGES, PROFILES, upper, type Lang } from '../core/lang';
import { LAYOUTS } from '../ui/components/layouts';
import en from '../i18n/en.json';

const fetched: string[] = [];
function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const m = String(input).match(/dict\/([A-Za-z-]+)\.kowd$/);
    if (m) {
      fetched.push(m[1]!);
      const b = fs.readFileSync(path.resolve(`public/dict/${m[1]}.kowd`));
      const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => ab } as Response;
    }
    return { ok: false, status: 404, statusText: 'Not Found' } as Response;
  }));
}

describe('switching language in Settings', () => {
  beforeEach(() => {
    stubFetch();
    fetched.length = 0;
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    localStorage.clear();
    useSession.getState().forget();
    useSettings.setState({ language: 'en' });
    useGame.setState({
      screen: 'loading', data: null, loadError: null, round: null, prompt: null,
      submissions: [], totalScore: 0, endsAt: 0, lastResult: null, outcome: null,
      streak: 0, bestStreak: 0, mode: 'solo',
    });
  });

  it('Turkish: menus, html lang, dictionary and keyboard change together, and a Turkish word scores', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Enter the Battle/i })).toBeInTheDocument(), { timeout: 5000 });
    expect(fetched).toEqual(['en']);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const picker = screen.getByLabelText('Language');
    // every language is offered in its own name
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(
      LANGUAGES.map((l) => PROFILES[l].name)
    );
    await user.selectOptions(picker, 'tr');

    await waitFor(() => expect(screen.getByText(RESOURCES.tr.translation.settings!.languageHint!)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Ayarlar' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('tr');
    expect(fetched).toEqual(['en', 'tr']);
    expect(useGame.getState().data!.dict.lang).toBe('tr');
    expect(useGame.getState().screen).toBe('settings'); // the switch does not throw you out

    await user.click(screen.getByRole('button', { name: 'Geri' }));
    await user.click(screen.getByRole('button', { name: /Savaşa gir/i }));
    await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });

    // the Turkish keyboard: Ğ Ş Ç Ö Ü, dotted İ and dotless I, and no Q W X
    for (const k of ['Ğ', 'Ş', 'Ç', 'Ö', 'Ü', 'İ', 'I']) expect(screen.getByRole('button', { name: k })).toBeInTheDocument();
    for (const k of ['Q', 'W', 'X']) expect(screen.queryByRole('button', { name: k })).toBeNull();

    // a word for the prompt, typed in capitals the way a Turkish keyboard sends them
    const { prompt: p, data } = useGame.getState();
    const word = data!.dict.list().find((w) => w.length >= 4 && w.length <= 8 && matchesRule(w, p!.condition, p!.letter))!;
    const input = screen.getByLabelText(RESOURCES.tr.translation.round!.placeholder!);
    await user.type(input, `${upper(word, 'tr')}{Enter}`);
    const last = useGame.getState().lastResult!;
    expect(last.word).toBe(word);
    expect(last.accepted).toBe(true);
    expect(useGame.getState().lang).toBe('tr');
  }, 40_000);

  it('the rule letter is shown with the language\'s own capital (i -> İ in Turkish)', async () => {
    useSettings.setState({ language: 'tr' });
    render(<App />);
    await waitFor(() => expect(useGame.getState().data?.dict.lang).toBe('tr'), { timeout: 5000 });
    useGame.getState().startRound('knight', 1);
    // force a known prompt so the assertion is not seed-dependent
    useGame.setState({ screen: 'playing', prompt: { ...useGame.getState().prompt!, letter: 'i' } });
    await waitFor(() => expect(document.querySelector('.rule-letter')?.textContent).toBe('İ'));
  });
});

describe('keyboard layouts', () => {
  it.each(LANGUAGES)('%s: every letter of the alphabet exactly once', (lang: Lang) => {
    const keys = LAYOUTS[lang].flatMap((row) => [...row]);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...PROFILES[lang].alphabet].sort());
  });
});

describe('translations', () => {
  const flat = (o: object, pre = ''): Record<string, string> =>
    Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => (
      typeof v === 'string' ? { ...acc, [pre + k]: v } : { ...acc, ...flat(v as object, `${pre}${k}.`) }
    ), {});
  const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
  const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
  const english = flat(en);

  it.each(LANGUAGES.filter((l) => l !== 'en'))('%s has every English key and no stray ones', (lang) => {
    const tr = flat(RESOURCES[lang].translation);
    for (const k of Object.keys(english).filter((k) => base(k) === k)) expect(tr, `${lang}: ${k}`).toHaveProperty([k]);
    for (const k of Object.keys(tr)) expect(english, `${lang}: stray ${k}`).toHaveProperty([base(k)]);
  });

  it.each(LANGUAGES.filter((l) => l !== 'en'))('%s keeps every {{placeholder}} of the English string', (lang) => {
    const tr = flat(RESOURCES[lang].translation);
    for (const [k, v] of Object.entries(tr)) expect(vars(v), `${lang}: ${k}`).toEqual(vars(english[base(k)]!));
  });

  it('plurals: _one where the language has it, the base key for everything else', async () => {
    const t = i18n.getFixedT('en');
    expect(t('round.possible', { count: 1 })).toBe('1 word fits');
    expect(t('round.possible', { count: 37 })).toBe('37 words fit');
    expect(i18n.getFixedT('fr')('ladder.sieges', { count: 1 })).toBe('1 siège');
    expect(i18n.getFixedT('fr')('ladder.sieges', { count: 0 })).toBe('0 siège'); // French: 0 is singular
    expect(i18n.getFixedT('es')('ladder.sieges', { count: 3 })).toBe('3 asedios');
    // French CLDR has a "many" form for millions; with no _many it must fall back, not print the key
    expect(i18n.getFixedT('fr')('ladder.sieges', { count: 1_000_000 })).toBe('1000000 sièges');
    // Turkish does not inflect a noun after a number
    expect(i18n.getFixedT('tr')('ladder.sieges', { count: 1 })).toBe('1 kuşatma');
  });
});
