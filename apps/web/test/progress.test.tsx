import type { CompletedSession } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { sessionPoints } from '../src/progress/series.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

function renderAt(path: string, sessions: CompletedSession[]) {
  const backend = fakeBackend();
  backend.sessions.set(tokenN(1), sessions);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const region = (name: string) => screen.getByRole('region', { name });

// Seven sessions. Worked out by hand from Spec 002: session 1 is practice;
// baseline = median of sessions 2–6, recent = median of sessions 3–7.
//   commissionRate 2–6: .2 .1 .3 .1 .2 → .2 (catch 80%); 3–7: .1 .3 .1 .2 0 → .1 (catch 90%)
//   medianGoRtMs   2–6: 400 420 380 410 390 → 400;       3–7: 420 380 410 390 350 → 390
const COMMISSION = [1, 0.2, 0.1, 0.3, 0.1, 0.2, 0];
const MEDIAN_RT = [900, 400, 420, 380, 410, 390, 350];
const seven = COMMISSION.map((c, i) =>
  storedSession(i + 1, {
    commissionRate: c,
    medianGoRtMs: MEDIAN_RT[i]!,
    flags: i === 3 ? ['high_omissions'] : [],
  }),
);

// 22 sessions: practice, 10 after poor sleep, 10 after good sleep, one without a check-in.
//   catch rate: poor 1 − .3 = 70%, good 1 − .1 = 90%; rhythm variability: poor 30%, good 20%
const withCheckIns = [
  storedSession(1, {}, { checkIn: { sleep: 'poor' } }),
  ...Array.from({ length: 10 }, (_, i) =>
    storedSession(
      i + 2,
      { commissionRate: 0.3, rtCv: 0.3 },
      {
        checkIn: { sleep: 'poor' },
        probes: i === 0 ? [{ afterIndex: 30, answer: 'drifting', preProbeCv: 0.25 }] : [],
      },
    ),
  ),
  ...Array.from({ length: 10 }, (_, i) =>
    storedSession(i + 12, { commissionRate: 0.1, rtCv: 0.2 }, { checkIn: { sleep: 'good' } }),
  ),
  storedSession(22),
];

describe('Progress screen', () => {
  it('invites a player with no sessions to play', async () => {
    renderAt('/progress', []);
    expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Start today's check" })).toHaveAttribute(
      'href',
      '/play',
    );
  });

  it('counts down to the starting point and shows this week', async () => {
    renderAt('/progress', seven.slice(0, 3));
    expect(
      await screen.findByText('Your starting point is set after 3 more sessions.'),
    ).toBeInTheDocument();
    expect(region('This week')).toHaveTextContent('1 of 4 days this week');
    expect(within(region('This week')).getAllByTestId('week-day')).toHaveLength(7);
  });

  it('says when the weekly goal is reached', async () => {
    const day = (d: number) => {
      const t = new Date();
      return new Date(t.getFullYear(), t.getMonth(), t.getDate() - d, 12);
    };
    renderAt(
      '/progress',
      [0, 1, 2, 4, 6].map((d, i) => storedSession(i + 1, {}, { completedAt: day(d) })),
    );
    expect(await screen.findByText('Goal reached: 5 days this week')).toBeInTheDocument();
  });

  it('compares recent sessions with where the player started, with n', async () => {
    renderAt('/progress', seven);
    const card = await screen.findByRole('region', { name: 'Recent vs. where you started' });
    const cells = (name: RegExp) =>
      within(within(card).getByRole('row', { name }))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(cells(/catch rate/i)).toEqual(['80% (n = 5)', '90% (n = 5)']);
    expect(cells(/median response/i)).toEqual(['400 ms (n = 5)', '390 ms (n = 5)']);
    expect(within(card).queryByText(/better|worse/i)).toBeNull();
  });

  it('captions each chart with its latest value', async () => {
    renderAt('/progress', seven);
    const chart = await screen.findByRole('figure', { name: 'Catch rate' });
    expect(chart).toHaveTextContent('Latest: 100% (session 7)');
    expect(screen.getByRole('figure', { name: 'Median response' })).toHaveTextContent(
      'Latest: 350 ms (session 7)',
    );
  });

  it('shows group dots with n, and a pattern sentence only when both groups have 10', async () => {
    renderAt('/progress', withCheckIns);
    const sleep = await screen.findByRole('region', { name: 'Sleep' });
    expect(within(sleep).getByText('Poor · n = 10')).toBeInTheDocument();
    expect(within(sleep).getByText('OK · n = 0')).toBeInTheDocument();
    expect(within(sleep).getByText('Good · n = 10')).toBeInTheDocument();
    expect(within(sleep).getAllByTestId('group-median')).toHaveLength(2);
    expect(within(sleep).getAllByTestId('group-dot')).toHaveLength(20);
    expect(sleep).toHaveTextContent(
      'So far, your median catch rate was 70% after poor sleep and 90% after good sleep. This is a pattern so far, not a cause.',
    );

    const stress = region('Stress');
    expect(stress).toHaveTextContent('Each group needs at least 10 sessions');
    expect(within(stress).queryByText(/pattern so far/)).toBeNull();
  });

  it('draws the one median that exists but no sentence when only one group has 10', async () => {
    // practice, 10 after poor sleep, 8 after good sleep
    const oneLarge = [
      storedSession(1, {}, { checkIn: { sleep: 'poor' } }),
      ...Array.from({ length: 10 }, (_, i) =>
        storedSession(i + 2, { commissionRate: 0.3 }, { checkIn: { sleep: 'poor' } }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        storedSession(i + 12, { commissionRate: 0.1 }, { checkIn: { sleep: 'good' } }),
      ),
    ];
    renderAt('/progress', oneLarge);
    const sleep = await screen.findByRole('region', { name: 'Sleep' });
    expect(within(sleep).getByText('Good · n = 8')).toBeInTheDocument();
    expect(within(sleep).getAllByTestId('group-median')).toHaveLength(1);
    expect(sleep).toHaveTextContent('Each group needs at least 10 sessions');
    expect(sleep).not.toHaveTextContent(/pattern so far/);
  });

  it('switches the compared metric', async () => {
    renderAt('/progress', withCheckIns);
    const picker = await screen.findByRole('group', { name: 'Compare' });
    expect(within(picker).getByRole('radio', { name: 'Catch rate' })).toBeChecked();
    fireEvent.click(within(picker).getByRole('radio', { name: 'Rhythm variability' }));
    expect(region('Sleep')).toHaveTextContent(
      'So far, your median rhythm variability was 30% after poor sleep and 20% after good sleep.',
    );
  });

  it('shows pre-probe variability by answer the same way', async () => {
    renderAt('/progress', withCheckIns);
    const preProbe = await screen.findByRole('region', {
      name: 'Before each "where was your mind?"',
    });
    expect(within(preProbe).getByText('Drifting · n = 1')).toBeInTheDocument();
    expect(within(preProbe).queryAllByTestId('group-median')).toHaveLength(0);
    expect(preProbe).toHaveTextContent('Each group needs at least 10 sessions');
  });
});

describe('Home', () => {
  it('shows this week and the starting-point countdown', async () => {
    renderAt('/', seven.slice(0, 2));
    expect(await screen.findByText('1 of 4 days this week')).toBeInTheDocument();
    expect(screen.getByText('4 more sessions until your starting point')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '/progress');
  });
});

describe('sessionPoints', () => {
  it('numbers sessions, converts catch rate and marks practice and flagged sessions', () => {
    const points = sessionPoints(seven);
    expect(points.map((p) => p.session)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(points.map((p) => p.catchRate)).toEqual([0, 0.8, 0.9, 0.7, 0.9, 0.8, 1]);
    expect(points.map((p) => p.practice)).toEqual([true, false, false, false, false, false, false]);
    expect(points[3]!.flags).toEqual(['high_omissions']);
    expect(points[0]!.medianGoRtMs).toBe(900);
  });
});
