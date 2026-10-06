import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const rows = {
  day:   [{ rank: 1, name: 'Bob', house: 'azure', score: 650, sieges: 1, isMe: false },
          { rank: 2, name: 'Alice', house: 'crimson', score: 500, sieges: 1, isMe: true }],
  week:  [{ rank: 1, name: 'Alice', house: 'crimson', score: 800, sieges: 2, isMe: true }],
  month: [],
  year:  [],
};

describe('Ladder screen', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../platform/supabase'); });

  it('says the ladder is not open yet when there is no server - not an empty board', async () => {
    vi.doMock('../platform/supabase', async (orig) => ({
      ...(await orig<typeof import('../platform/supabase')>()), isConfigured: () => false,
    }));
    const { Ladder } = await import('../ui/screens/Ladder');
    await import('../i18n');
    render(<Ladder />);
    expect(screen.getByText(/opens when the realm's server is raised/i)).toBeInTheDocument();
  });

  it('shows each period, highlights the player, and handles an empty period', async () => {
    const fetchLeaderboard = vi.fn(async (p: keyof typeof rows) => rows[p]);
    vi.doMock('../platform/supabase', async (orig) => ({
      ...(await orig<typeof import('../platform/supabase')>()),
      isConfigured: () => true, fetchLeaderboard,
    }));
    const { Ladder } = await import('../ui/screens/Ladder');
    await import('../i18n');
    const user = userEvent.setup();
    render(<Ladder />);

    await waitFor(() => expect(screen.getByText('650')).toBeInTheDocument());
    expect(screen.getByText(/Alice/).closest('li')).toHaveClass('is-me');
    // the ladder of the language being played - English here
    expect(fetchLeaderboard).toHaveBeenCalledWith('day', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 50, 'en');

    await user.click(screen.getByRole('tab', { name: 'Week' }));
    await waitFor(() => expect(screen.getByText('800')).toBeInTheDocument());
    expect(screen.getByText('2 sieges')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Month' }));
    await waitFor(() => expect(screen.getByText(/No one has besieged yet/i)).toBeInTheDocument());
    expect(fetchLeaderboard.mock.calls.map((c) => c[0])).toEqual(['day', 'week', 'month']);
  });

  it('reports a failure instead of spinning forever', async () => {
    vi.doMock('../platform/supabase', async (orig) => ({
      ...(await orig<typeof import('../platform/supabase')>()),
      isConfigured: () => true, fetchLeaderboard: vi.fn(async () => { throw new Error('offline'); }),
    }));
    const { Ladder } = await import('../ui/screens/Ladder');
    await import('../i18n');
    render(<Ladder />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/i));
  });
});
