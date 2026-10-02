import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useGame } from '../store/gameStore';
import { buildGameData } from '../core/load';
import { matchesRule } from '../core/dictionary';

const blob = () => {
  const b = fs.readFileSync(path.resolve('public/dict/en.kowd'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const data = buildGameData(blob());

/** Serve the real dictionary over a stubbed fetch; audio 404s (harmless). */
function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('en.kowd')) {
      return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => blob() } as Response;
    }
    return { ok: false, status: 404, statusText: 'Not Found' } as Response;
  }));
}

/** Find a word in the shipped dictionary that satisfies the on-screen prompt. */
function wordForCurrentPrompt(minLen: number): string {
  const p = useGame.getState().prompt!;
  const played = useGame.getState().round!.playedWords;
  for (const w of data.words) {
    if (w.length < minLen || w.length > 9) continue;
    if (played.has(w)) continue;
    if ((data.dict.tierOf(w) ?? 99) > useGame.getState().round!.config.maxTier) continue;
    if (matchesRule(w, p.condition, p.letter)) return w;
  }
  throw new Error(`no word satisfies ${p.condition} "${p.letter}"`);
}

describe('full gameplay, through the real UI', () => {
  beforeEach(() => {
    stubFetch();
    useGame.setState({
      screen: 'loading', data: null, loadError: null, round: null, prompt: null,
      submissions: [], totalScore: 0, endsAt: 0, lastResult: null,
    });
  });

  it('boots, loads the dictionary, plays a round and reports a score', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. boot
    expect(screen.getByText(/Mustering the lexicon/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });

    // 2. start. A guest gets one rank and no picker - choosing a rank is part
    //    of what signing in opens up, so there is nothing to click here.
    expect(screen.queryByLabelText(/Squire/i, { selector: 'input' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Enter the Battle/i }));

    // 3. countdown -> playing
    await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });
    expect(screen.getByRole('timer')).toBeInTheDocument();

    // 4. play five valid words
    const input = screen.getByLabelText(/Type your word/i);
    let expected = 0;
    for (let i = 0; i < 5; i++) {
      const word = wordForCurrentPrompt(useGame.getState().round!.config.minWordLength);
      await user.clear(input);
      await user.type(input, word);
      await user.click(screen.getByRole('button', { name: /Strike/i }));
      const last = useGame.getState().lastResult!;
      expect(last.accepted, `"${word}" should be accepted`).toBe(true);
      expected += last.points;
    }
    expect(useGame.getState().totalScore).toBeCloseTo(Math.round(expected * 100) / 100, 2);
    expect(useGame.getState().totalScore).toBeGreaterThan(0);

    // 5. the score is actually rendered
    const hud = screen.getByText('Score').closest('.hud-item') as HTMLElement;
    expect(within(hud).getByText(useGame.getState().totalScore.toFixed(2))).toBeInTheDocument();

    // 6. give up -> results
    await user.click(screen.getByRole('button', { name: /Give Up/i }));
    await user.click(screen.getByRole('button', { name: /Yes, retreat/i }));
    await waitFor(() => expect(screen.getByText(/The Battle Is Done/i)).toBeInTheDocument());
    expect(screen.getByText(useGame.getState().totalScore.toFixed(2))).toBeInTheDocument();
  }, 40_000);

  it('REGRESSION: a duplicate word is rejected in the real UI', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: /Enter the Battle/i }));
    await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });

    const input = screen.getByLabelText(/Type your word/i);
    const word = wordForCurrentPrompt(useGame.getState().round!.config.minWordLength);
    await user.type(input, word);
    await user.click(screen.getByRole('button', { name: /Strike/i }));
    expect(useGame.getState().lastResult!.accepted).toBe(true);

    // force the same prompt back, then replay the same word
    const r = useGame.getState().round!;
    // @ts-expect-error - test seam
    r.prompt = { ...useGame.getState().prompt!, condition: 'includes', letter: word[0]! };
    useGame.setState({ prompt: r.state.prompt });
    await user.clear(input);
    await user.type(input, word);
    await user.click(screen.getByRole('button', { name: /Strike/i }));

    expect(useGame.getState().lastResult!.accepted).toBe(false);
    expect(useGame.getState().lastResult!.reason).toBe('duplicate');
    expect(await screen.findByText(/Already played/i)).toBeInTheDocument();
  }, 40_000);

  it('REGRESSION: uppercase typing still scores', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: /Enter the Battle/i }));
    await waitFor(() => expect(useGame.getState().screen).toBe('playing'), { timeout: 6000 });

    const input = screen.getByLabelText(/Type your word/i);
    const word = wordForCurrentPrompt(useGame.getState().round!.config.minWordLength);
    await user.type(input, word.toUpperCase());
    await user.click(screen.getByRole('button', { name: /Strike/i }));
    expect(useGame.getState().lastResult!.accepted).toBe(true);
    expect(useGame.getState().lastResult!.points).toBeGreaterThan(0);
  }, 40_000);

  it('shows the credits with both licence notices', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText('King of Wordor')).toBeInTheDocument(), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: /Credits/i }));
    expect(screen.getByText(/Kevin Atkinson/)).toBeInTheDocument();
    expect(screen.getByText(/Princeton University/)).toBeInTheDocument();
  }, 20_000);
});
