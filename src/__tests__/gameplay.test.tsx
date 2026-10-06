import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useGame } from '../store/gameStore';
import { useSession } from '../store/sessionStore';
import { buildGameData } from '../core/load';
import { matchesRule } from '../core/dictionary';
import { SKIP_PENALTY_MS } from '../core/round';

const blob = () => {
  const b = fs.readFileSync(path.resolve('public/dict/en.kowd'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const data = buildGameData(blob());

/** Serve the real dictionary over a stubbed fetch; audio and sprites 404 (harmless). */
function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('en.kowd')) {
      return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => blob() } as Response;
    }
    return { ok: false, status: 404, statusText: 'Not Found' } as Response;
  }));
}

/** jsdom has no canvas or ResizeObserver; the battlefield must degrade, not crash. */
function stubBrowserBits() {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

/** Find a word in the shipped dictionary that satisfies the on-screen prompt. */
function wordForCurrentPrompt(): string {
  const { prompt: p, round } = useGame.getState();
  const played = round!.playedWords;
  for (const w of data.words) {
    if (w.length < round!.config.minWordLength || w.length > 9) continue;
    if (played.has(w)) continue;
    if ((data.dict.tierOf(w) ?? 99) > round!.config.maxTier) continue;
    if (matchesRule(w, p!.condition, p!.letter)) return w;
  }
  throw new Error(`no word satisfies ${p!.condition} "${p!.letter}"`);
}

async function bootToKeep() {
  render(<App />);
  await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });
}

async function startSolo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Enter the Battle/i }));
  await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });
}

async function play(user: ReturnType<typeof userEvent.setup>, word: string) {
  const input = screen.getByLabelText(/Type your word/i);
  await user.clear(input);
  await user.type(input, `${word}{Enter}`);
}

describe('full gameplay, through the real UI', () => {
  beforeEach(() => {
    stubFetch();
    stubBrowserBits();
    localStorage.clear();
    useSession.getState().forget();
    useGame.setState({
      screen: 'loading', data: null, loadError: null, round: null, prompt: null,
      submissions: [], totalScore: 0, endsAt: 0, lastResult: null, outcome: null,
      streak: 0, bestStreak: 0, mode: 'solo',
    });
  });

  it('boots, plays a round, and the results show score, XP and rank', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/Mustering the lexicon/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });

    // every difficulty works without a server, so a guest can choose one
    expect(screen.getByLabelText(/Squire/i, { selector: 'input' })).toBeInTheDocument();
    await startSolo(user);
    expect(screen.getByRole('timer')).toBeInTheDocument();

    let expected = 0;
    for (let i = 0; i < 5; i++) {
      const word = wordForCurrentPrompt();
      await play(user, word);
      const last = useGame.getState().lastResult!;
      expect(last.accepted, `"${word}" should be accepted`).toBe(true);
      expect(Number.isInteger(last.points)).toBe(true);
      expected += last.points;
    }
    // the total is exactly the sum of what the player saw
    expect(useGame.getState().totalScore).toBe(expected);
    expect(useGame.getState().streak).toBe(5);

    await user.click(screen.getByRole('button', { name: /Give up/i }));
    await user.click(screen.getByRole('button', { name: /Yes, retreat/i }));
    await waitFor(() => expect(screen.getByText(/The Battle Is Done/i)).toBeInTheDocument());

    const outcome = useGame.getState().outcome!;
    expect(outcome.xpGained).toBe(expected + 10);
    expect(outcome.newBest).toBe(true);
    expect(useSession.getState().localBest).toBe(expected);
    expect(screen.getByText(`+${expected + 10} XP`)).toBeInTheDocument();
  }, 40_000);

  it('RULE: a wrong word keeps the prompt on screen', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    await startSolo(user);
    const before = useGame.getState().prompt;
    await play(user, 'qqqqzz');
    expect(useGame.getState().lastResult!.accepted).toBe(false);
    expect(useGame.getState().prompt).toBe(before);
    expect(useGame.getState().streak).toBe(0);
  }, 30_000);

  it('RULE: skip changes the prompt and costs three seconds', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    await startSolo(user);
    const before = useGame.getState().prompt;
    const endsAt = useGame.getState().endsAt;
    await user.click(screen.getByRole('button', { name: /Skip/i }));
    expect(useGame.getState().prompt).not.toBe(before);
    expect(useGame.getState().endsAt).toBe(endsAt - SKIP_PENALTY_MS);
  }, 30_000);

  it('REGRESSION: a duplicate word is rejected in the real UI', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    await startSolo(user);
    const word = wordForCurrentPrompt();
    await play(user, word);
    expect(useGame.getState().lastResult!.accepted).toBe(true);

    // force a prompt the same word satisfies, then replay it
    const r = useGame.getState().round!;
    // @ts-expect-error - test seam
    r.prompt = { ...useGame.getState().prompt!, condition: 'includes', letter: word[0]! };
    useGame.setState({ prompt: r.state.prompt });
    await play(user, word);
    expect(useGame.getState().lastResult!.accepted).toBe(false);
    expect(useGame.getState().lastResult!.reason).toBe('duplicate');
  }, 30_000);

  it('REGRESSION: uppercase typing still scores', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    await startSolo(user);
    await play(user, wordForCurrentPrompt().toUpperCase());
    expect(useGame.getState().lastResult!.accepted).toBe(true);
    expect(useGame.getState().lastResult!.points).toBeGreaterThan(0);
  }, 30_000);

  it('DAILY: one siege a day, then the card shows it is won', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    // the Ladder card's description also mentions the Daily Siege, so match the card's own title
    await user.click(screen.getByRole('button', { name: /^Daily Siege #\d+/i }));
    await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });
    expect(useGame.getState().mode).toBe('daily');
    await play(user, wordForCurrentPrompt());
    await user.click(screen.getByRole('button', { name: /Give up/i }));
    await user.click(screen.getByRole('button', { name: /Yes, retreat/i }));
    await waitFor(() => expect(screen.getByText(/Daily Siege #/i)).toBeInTheDocument());
    expect(useGame.getState().outcome!.streak).toBe(1);
    // no "again" on a daily: it is once a day by design
    expect(screen.queryByRole('button', { name: /Fight Again/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /To the Keep/i }));
    await waitFor(() => expect(screen.getByText(/siege is won/i)).toBeInTheDocument());
    expect(screen.getByText(/Next siege in/i)).toBeInTheDocument();
  }, 40_000);

  it('the same daily seed gives every player the same first prompt', () => {
    const day = new Date(2026, 9, 6, 9, 0);
    useGame.setState({ data, screen: 'welcome' });
    useGame.getState().startDaily(day);
    const a = useGame.getState().prompt;
    useGame.getState().startDaily(new Date(2026, 9, 6, 21, 30));
    const b = useGame.getState().prompt;
    expect(a).toEqual(b);
  });

  it('shows the credits with both licence notices', async () => {
    const user = userEvent.setup();
    await bootToKeep();
    await user.click(screen.getByRole('button', { name: /Credits/i }));
    expect(screen.getByText(/Kevin Atkinson/)).toBeInTheDocument();
    expect(screen.getByText(/Princeton University/)).toBeInTheDocument();
  }, 20_000);
});

// keep `within` referenced for future HUD assertions without tripping lint
void within;
