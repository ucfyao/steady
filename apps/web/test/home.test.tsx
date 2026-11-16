import { PROGRESS_CONFIG, type CompletedSession } from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { lastCheckDay } from '../src/progress/lastCheck.js';
import { WeekDots } from '../src/progress/WeekDots.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

function renderHome(sessions: CompletedSession[]) {
  const backend = fakeBackend();
  backend.sessions.set(tokenN(1), sessions);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const daysAgo = (d: number) => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - d, 12);
};
const stat = (label: string) => screen.getByRole('group', { name: label });

describe('Home', () => {
  it('greets the player, says what the check is, and starts it', async () => {
    renderHome([]);
    expect(await screen.findByRole('heading', { name: 'Hi, Player 1' })).toBeInTheDocument();
    expect(
      screen.getByText('Three minutes. Catch every digit, hold back on 3.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Start today's check" })).toHaveAttribute(
      'href',
      '/play',
    );
  });

  it('with no sessions: an empty week, a first-check invitation and the countdown', async () => {
    renderHome([]);
    const week = await screen.findByRole('region', { name: 'Last 7 days' });
    // The target comes from core's config (Spec 004: 4 of the last 7 days).
    expect(week).toHaveTextContent(`0 of ${PROGRESS_CONFIG.weeklyTargetDays} days`);
    expect(within(week).getAllByTestId('week-day')).toHaveLength(7);
    const last = screen.getByRole('region', { name: 'Last check' });
    expect(last).toHaveTextContent(/no checks yet/i);
    expect(within(last).queryAllByRole('group')).toHaveLength(0);
    // Session 1 is practice, sessions 2–6 set the starting point.
    expect(screen.getByText('6 more sessions until your starting point')).toBeInTheDocument();
  });

  it('before the baseline: the last check with its numbers, and the countdown', async () => {
    renderHome([
      storedSession(1, {}, { completedAt: daysAgo(2) }),
      storedSession(
        2,
        { commissionRate: 0.25, longestSteadyRun: 41, medianGoRtMs: 388.4 },
        { completedAt: daysAgo(0) },
      ),
    ]);
    const last = await screen.findByRole('region', { name: 'Last check · Today' });
    // Catch rate = 1 − commissionRate (Spec 002), as on Results.
    expect(within(last).getByRole('group', { name: 'Catch rate' })).toHaveTextContent('75%');
    expect(stat('Longest steady run')).toHaveTextContent('41');
    expect(stat('Median response')).toHaveTextContent('388 ms');
    expect(screen.getByRole('region', { name: 'Last 7 days' })).toHaveTextContent('2 of 4 days');
    expect(screen.getByText('4 more sessions until your starting point')).toBeInTheDocument();
  });

  it('after the baseline: no countdown, and a missing median says so', async () => {
    renderHome(
      Array.from({ length: 7 }, (_, i) =>
        storedSession(i + 1, i === 6 ? { medianGoRtMs: null } : {}, {
          completedAt: daysAgo(20 - i),
        }),
      ),
    );
    await screen.findByRole('region', { name: /^Last check · / });
    // A dash and a short note on its own line, aligned like the other two stats.
    expect(stat('Median response')).toHaveTextContent(/^—Not enough dataMedian response$/);
    expect(screen.getByText('Not enough data')).toHaveClass(/note/);
    expect(screen.queryByText(/until your starting point/)).toBeNull();
  });

  it('says the weekly goal is reached on exactly the target day count', async () => {
    renderHome([0, 1, 2, 4].map((d, i) => storedSession(i + 1, {}, { completedAt: daysAgo(d) })));
    expect(await screen.findByRole('region', { name: 'Last 7 days' })).toHaveTextContent(
      '4 days, goal reached',
    );
  });
});

describe('WeekDots', () => {
  const NOW = new Date(2026, 10, 20, 14, 0); // Friday 20 Nov 2026, local
  const at = (day: number) => new Date(2026, 10, day, 9).toISOString();

  it('labels the last 7 days by weekday, fills played days, and marks today', () => {
    render(<WeekDots completedAt={[at(16), at(17), at(19)]} now={NOW} />);
    const days = screen.getAllByTestId('week-day');
    expect(days.map((d) => d.textContent)).toEqual(['S', 'S', 'M', 'T', 'W', 'T', 'F']);
    expect(days.map((d) => d.dataset.played)).toEqual([
      'false',
      'false',
      'true',
      'true',
      'false',
      'true',
      'false',
    ]);
    expect(days.map((d) => d.dataset.today)).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
      'true',
    ]);
    expect(screen.getByText(/of 4 days/).textContent).toBe('3 of 4 days');
  });
});

describe('lastCheckDay', () => {
  const NOW = new Date(2026, 10, 16, 14, 0); // Monday 16 Nov 2026, local
  const at = (day: number, h = 9) => new Date(2026, 10, day, h).toISOString();

  it('says Today, Yesterday, a weekday within the week, then a date', () => {
    expect(lastCheckDay(at(16, 0), NOW)).toBe('Today');
    expect(lastCheckDay(at(15, 23), NOW)).toBe('Yesterday');
    expect(lastCheckDay(at(12), NOW)).toBe('Thu');
    expect(lastCheckDay(at(10), NOW)).toBe('Tue');
    expect(lastCheckDay(at(9), NOW)).toBe('9 Nov');
  });
});
