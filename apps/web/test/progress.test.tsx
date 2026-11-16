import type { CompletedSession } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { SessionDot } from '../src/progress/MetricChart.js';
import { sessionPoints, type SessionPoint } from '../src/progress/series.js';
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

// 11 sessions: practice, baseline = sessions 2–6, recent = sessions 7–11. Worked out by hand:
//   catch rate:  baseline 1 − .3 = 70%, recent 1 − .1 = 90% (beyond the 0.1 band): ↑ better
//   missed:      .05 both: ≈ similar
//   response:    400 → 350 ms (beyond 20 ms): ↓ faster, neither better nor below;
//                session 9 has no median, so recent n = 4
//   variation:   20% → 26% (beyond 0.02): ↑ less even, below
const improving = Array.from({ length: 11 }, (_, i) =>
  i < 6
    ? storedSession(i + 1, { commissionRate: 0.3, medianGoRtMs: 400, rtCv: 0.2 })
    : storedSession(i + 1, {
        commissionRate: 0.1,
        medianGoRtMs: i === 8 ? null : 350,
        rtCv: 0.26,
      }),
);

// 22 sessions: practice, 10 after poor sleep, 10 after good sleep, one without a check-in.
//   catch rate: poor 1 − .3 = 70%, good 1 − .1 = 90%; timing variation: poor 30%, good 20%
//   before a probe: on task 10% (n = 10), elsewhere 30% (n = 10), drifting 25% (n = 1)
const withCheckIns = [
  storedSession(1, {}, { checkIn: { sleep: 'poor' } }),
  ...Array.from({ length: 10 }, (_, i) =>
    storedSession(
      i + 2,
      { commissionRate: 0.3, rtCv: 0.3 },
      {
        checkIn: { sleep: 'poor' },
        probes: [
          { afterIndex: 30, answer: 'on_task', preProbeCv: 0.1 },
          { afterIndex: 60, answer: 'elsewhere', preProbeCv: 0.3 },
          ...(i === 0 ? [{ afterIndex: 90, answer: 'drifting' as const, preProbeCv: 0.25 }] : []),
        ],
      },
    ),
  ),
  ...Array.from({ length: 10 }, (_, i) =>
    storedSession(i + 12, { commissionRate: 0.1, rtCv: 0.2 }, { checkIn: { sleep: 'good' } }),
  ),
  storedSession(22),
];

// Practice, 10 after poor sleep, 8 after good sleep, no probes.
const oneLarge = [
  storedSession(1, {}, { checkIn: { sleep: 'poor' } }),
  ...Array.from({ length: 10 }, (_, i) =>
    storedSession(i + 2, { commissionRate: 0.3 }, { checkIn: { sleep: 'poor' } }),
  ),
  ...Array.from({ length: 8 }, (_, i) =>
    storedSession(i + 12, { commissionRate: 0.1 }, { checkIn: { sleep: 'good' } }),
  ),
];

/** Opens the collapsed Exploring patterns block. */
async function openExploring() {
  const toggle = await screen.findByText('Exploring patterns');
  fireEvent.click(toggle);
  return toggle.closest('details')!;
}

describe('Progress screen', () => {
  it('invites a player with no sessions to play', async () => {
    renderAt('/progress', []);
    expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Start today's check" })).toHaveAttribute(
      'href',
      '/play',
    );
  });

  it('counts down to the starting point in the summary and the table, and shows the week', async () => {
    renderAt('/progress', seven.slice(0, 3));
    expect(await screen.findByTestId('summary')).toHaveTextContent(
      '3 more sessions until your starting point. Until then, the charts show each check.',
    );
    expect(
      screen.getByText('Your starting point is set after 3 more sessions.'),
    ).toBeInTheDocument();
    expect(region('Last 7 days')).toHaveTextContent('1 of 4 days');
    expect(within(region('Last 7 days')).getAllByTestId('week-day')).toHaveLength(7);
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
    expect(await screen.findByRole('region', { name: 'Last 7 days' })).toHaveTextContent(
      '5 days, goal reached',
    );
  });

  it('sums up the recent checks against where the player started', async () => {
    renderAt('/progress', improving);
    expect(await screen.findByTestId('summary')).toHaveTextContent(
      'Your last 5 checks: better than where you started at holding back on 3s, below at keeping an even rhythm.',
    );
  });

  it('compares recent with where the player started, with arrows and better or below', async () => {
    renderAt('/progress', improving);
    const card = await screen.findByRole('region', { name: 'Recent vs. where you started' });
    const row = (name: RegExp) => within(card).getByRole('row', { name });
    const cells = (name: RegExp) =>
      within(row(name))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(within(row(/3s held back/)).getByRole('rowheader')).toHaveTextContent(
      '3s held backHigher is better',
    );
    expect(cells(/3s held back/)).toEqual(['70%', '90%', '↑ More held back · better']);
    expect(cells(/Digits missed/)).toEqual(['5%', '5%', '≈ Similar']);
    expect(cells(/Typical response time/)).toEqual(['400 ms', '350 ms', '↓ Faster']);
    expect(cells(/How much your timing varied/)).toEqual(['20%', '26%', '↑ Less even · below']);
    // Colour is only a second cue: the verdict is also in words.
    expect(within(row(/3s held back/)).getByTestId('change')).toHaveAttribute(
      'data-verdict',
      'better',
    );
    expect(within(row(/timing varied/)).getByTestId('change')).toHaveAttribute(
      'data-verdict',
      'worse',
    );
    // n is in the tooltip and the footnote, not next to each number.
    expect(within(row(/Typical response time/)).getAllByRole('cell')[1]).toHaveAttribute(
      'title',
      'Median of 4 sessions',
    );
    expect(within(row(/3s held back/)).getAllByRole('cell')[0]).toHaveAttribute(
      'title',
      'Median of 5 sessions',
    );
    expect(card).not.toHaveTextContent('n =');
    expect(card).toHaveTextContent(
      'Where you started: the middle of sessions 2–6. Recent: the middle of your last 5 checks. Typical response time, recent: 4 sessions (the others had too few presses).',
    );
  });

  it('captions each chart with its better direction, latest value and where the player started', async () => {
    renderAt('/progress', improving);
    const chart = await screen.findByRole('figure', { name: '3s held back' });
    expect(chart).toHaveTextContent('Higher is better');
    expect(chart).toHaveTextContent('Latest: 90% (session 11)');
    expect(chart).toHaveTextContent('Where you started: 70%');
    const rt = screen.getByRole('figure', { name: 'Typical response time' });
    expect(rt).toHaveTextContent('Neither way is better');
    expect(rt).toHaveTextContent('Latest: 350 ms (session 11)');
    expect(screen.getByRole('figure', { name: 'Digits missed' })).toHaveTextContent(
      'Lower is better',
    );
  });

  it('does not mention where the player started before it exists', async () => {
    renderAt('/progress', seven.slice(0, 3));
    const chart = await screen.findByRole('figure', { name: '3s held back' });
    expect(chart).not.toHaveTextContent('Where you started');
  });

  it('lists the latest 10 sessions, newest first, each linking to its results', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) =>
      storedSession(i + 1, { commissionRate: 0.25, medianGoRtMs: 401.6 }),
    );
    renderAt('/progress', twelve);
    const list = await screen.findByRole('region', { name: 'Your sessions' });
    const links = () => within(list).getAllByRole('link');
    expect(links()).toHaveLength(10);
    expect(links()[0]).toHaveAttribute('href', '/results/s12');
    expect(links()[0]).toHaveTextContent('Session 12');
    expect(links()[0]).toHaveTextContent('75%');
    expect(links()[0]).toHaveTextContent('402 ms');
    expect(links()[9]).toHaveAttribute('href', '/results/s3');

    fireEvent.click(within(list).getByRole('button', { name: 'Show all 12 sessions' }));
    expect(links()).toHaveLength(12);
    expect(links()[11]).toHaveAttribute('href', '/results/s1');
    expect(links()[11]).toHaveTextContent('Practice');
    expect(links()[10]).not.toHaveTextContent('Practice');

    fireEvent.click(within(list).getByRole('button', { name: 'Show only the latest 10' }));
    expect(links()).toHaveLength(10);
  });

  it('has no Show all button for 10 sessions or fewer', async () => {
    renderAt('/progress', seven);
    const list = await screen.findByRole('region', { name: 'Your sessions' });
    expect(within(list).getAllByRole('link')).toHaveLength(7);
    expect(within(list).queryByRole('button')).toBeNull();
  });

  it('keeps Exploring patterns collapsed until opened', async () => {
    renderAt('/progress', withCheckIns);
    const toggle = await screen.findByText('Exploring patterns');
    const details = toggle.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(toggle);
    expect(details).toHaveAttribute('open');
  });

  it('draws only answers with a median, with an axis, and the pattern sentence', async () => {
    renderAt('/progress', withCheckIns);
    await openExploring();
    const sleep = region('Sleep');
    expect(within(sleep).getByText('Poor · n = 10')).toBeInTheDocument();
    expect(within(sleep).getByText('Good · n = 10')).toBeInTheDocument();
    expect(within(sleep).queryByText('OK · n = 0')).toBeNull();
    expect(sleep).toHaveTextContent('Not shown yet (fewer than 10 sessions): OK, n = 0');
    expect(within(sleep).getAllByTestId('group-median')).toHaveLength(2);
    expect(within(sleep).getAllByTestId('group-dot')).toHaveLength(20);
    // Values 70% and 90%: steps of 5% (Spec 004 axis rules).
    expect(
      within(sleep)
        .getAllByTestId('axis-tick')
        .map((t) => t.textContent),
    ).toEqual(['70%', '75%', '80%', '85%', '90%']);
    expect(sleep).toHaveTextContent('3s held back · Higher is better');
    expect(sleep).toHaveTextContent(
      'So far, “3s held back” had a median of 70% after poor sleep and 90% after good sleep. This is a pattern so far, not a cause.',
    );
  });

  it('collapses a part to how many more sessions it needs', async () => {
    renderAt('/progress', oneLarge);
    await openExploring();
    // Sleep: poor 10, good 8 → 2 more. Stress: none → 10 + 10.
    const sleep = region('Sleep');
    expect(sleep).toHaveTextContent('Needs at least 2 more sessions with a check-in.');
    expect(within(sleep).queryAllByTestId('group-dot')).toHaveLength(0);
    expect(within(sleep).queryAllByTestId('group-median')).toHaveLength(0);
    expect(sleep).not.toHaveTextContent(/pattern so far/);
    expect(region('Stress')).toHaveTextContent('Needs at least 20 more sessions with a check-in.');
    // No probe answers: 20 answers at 4 per session → 5 sessions.
    expect(region('Before each “where was your mind?”')).toHaveTextContent(
      'Needs at least 5 more sessions.',
    );
  });

  it('switches the metric for check-ins only; the pre-probe part keeps its own measure', async () => {
    renderAt('/progress', withCheckIns);
    await openExploring();
    const preProbe = region('Before each “where was your mind?”');
    expect(preProbe).toHaveTextContent(
      'how much your timing varied over the 8 digits just before each question',
    );
    const before = preProbe.textContent;
    expect(preProbe).toHaveTextContent(
      'So far, how much your timing varied just before a question had a median of 10% when you answered on task and 30% when you answered elsewhere. This is a pattern so far, not a cause.',
    );
    expect(preProbe).toHaveTextContent('Not shown yet (fewer than 10 answers): Drifting, n = 1');

    const picker = screen.getByRole('group', { name: 'Compare' });
    expect(within(picker).getByRole('radio', { name: '3s held back' })).toBeChecked();
    fireEvent.click(within(picker).getByRole('radio', { name: 'How much your timing varied' }));
    expect(region('Sleep')).toHaveTextContent(
      'So far, “How much your timing varied” had a median of 30% after poor sleep and 20% after good sleep.',
    );
    expect(region('Before each “where was your mind?”').textContent).toBe(before);
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

describe('chart points', () => {
  const [practice, , , flagged, normal] = sessionPoints(seven);
  const drawn = (payload: SessionPoint) => {
    const { container } = render(
      <svg>
        <SessionDot cx={10} cy={10} payload={payload} />
      </svg>,
    );
    return container.querySelector('[data-kind]')!;
  };

  it('tells practice, flagged and other sessions apart by shape, not only colour', () => {
    expect(drawn(practice!).tagName).toBe('circle');
    expect(drawn(practice!)).toHaveAttribute('data-kind', 'practice');
    expect(drawn(flagged!).tagName).toBe('path'); // a diamond
    expect(drawn(flagged!)).toHaveAttribute('data-kind', 'flagged');
    expect(drawn(normal!)).toHaveAttribute('data-kind', 'normal');
  });
});
