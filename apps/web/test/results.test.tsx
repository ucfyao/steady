import {
  createSessionPlan,
  scoreSession,
  type CompletedSession,
  type PlanTrial,
  type ProbeAnswer,
} from '@steady/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { saveProfiles } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

const plan = createSessionPlan(7);
const targets = plan.trials.filter((t) => t.isTarget);
const gos = plan.trials.filter((t) => !t.isTarget && t.index > 10);
const COMMISSION = targets[2]!.index;
const OMISSION = gos[0]!.index;
const ANTICIPATION = gos[1]!.index;
const ANSWERS: ProbeAnswer[] = ['on_task', 'drifting', 'elsewhere'];

/** A stored session as the server returns it. Test code may score (it plays the server). */
function completed(id: string, rtFor: (t: PlanTrial) => number | null): CompletedSession {
  return {
    id,
    startedAt: '2026-11-16T09:00:00.000Z',
    completedAt: '2026-11-16T09:03:00.000Z',
    checkIn: null,
    device: 'keyboard',
    variant: 'calm',
    score: scoreSession(plan, { rts: plan.trials.map(rtFor), probeAnswers: ANSWERS }),
  };
}

// One 3 pressed, one digit missed, one press too early, everything else at 400 ms.
const mixed = completed('s1', (t) => {
  if (t.index === COMMISSION) return 420;
  if (t.index === OMISSION) return null;
  if (t.index === ANTICIPATION) return 50;
  return t.isTarget ? null : 400;
});
const neverPressed = completed('s2', () => null);

function renderResults(
  entry: string | { pathname: string; state: unknown },
  history: CompletedSession[] = [mixed, neverPressed],
  setup?: (backend: ReturnType<typeof fakeBackend>) => void,
) {
  const backend = fakeBackend();
  backend.sessions.set(tokenN(1), history);
  setup?.(backend);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[entry]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const tile = (label: string) => screen.getByRole('group', { name: label });

describe('Results', () => {
  it('shows the summary, tiles and plain-words flags from the server score', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    // From the spec: 9 targets per session (Spec 005), one of them pressed.
    expect(await screen.findByRole('group', { name: '3s held back' })).toHaveTextContent('89%');
    // The count lives in the catch-rate tile; no second sentence repeats it.
    expect(tile('3s held back')).toHaveTextContent('8 of 9');
    expect(screen.queryByText(/you caught/i)).toBeNull();
    expect(tile('Typical response time')).toHaveTextContent('400 ms');
    expect(tile('How much your timing varied')).toHaveTextContent('0%');
    expect(tile('Digits missed')).toHaveTextContent('1');
    expect(tile('Longest steady run')).toHaveTextContent(`${mixed.score.longestSteadyRun} trials`);
    // Constant 400 ms is machine-like: the server raised regular_timing.
    expect(screen.getByText(/unusually even/i)).toBeInTheDocument();
  });

  it('draws one ribbon cell per trial with the server outcome, and marks the longest run', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    const ribbon = await screen.findByRole('img', { name: /session journey/i });
    const cells = within(ribbon).getAllByTestId('trial');
    expect(cells).toHaveLength(81);
    expect(cells[COMMISSION]).toHaveAttribute('data-outcome', 'commission');
    expect(cells[OMISSION]).toHaveAttribute('data-outcome', 'omission');
    expect(cells[ANTICIPATION]).toHaveAttribute('data-outcome', 'anticipation');
    expect(cells[targets[0]!.index]).toHaveAttribute('data-outcome', 'caught');
    cells.forEach((c, i) =>
      expect(c).toHaveAttribute('data-outcome', mixed.score.trialOutcomes[i]),
    );

    const inRun = cells.flatMap((c, i) => (c.dataset.longest === 'true' ? [i] : []));
    expect(inRun).toHaveLength(mixed.score.longestSteadyRun);
    expect(inRun.at(-1)! - inRun[0]!).toBe(inRun.length - 1); // one contiguous stretch
    for (const i of inRun) expect(['steady', 'caught']).toContain(cells[i]!.dataset.outcome);
  });

  it('marks each probe after its trial with the answer', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    const ribbon = await screen.findByRole('img', { name: /session journey/i });
    const cells = within(ribbon).getAllByTestId('trial');
    plan.probeAfter.forEach((p, k) => {
      const marker = within(cells[p]!).getByTestId('probe');
      expect(marker).toHaveAttribute('data-answer', ANSWERS[k]);
    });
    expect(within(ribbon).getAllByTestId('probe')).toHaveLength(3);
    expect(screen.getByText('Drifting')).toBeInTheDocument(); // legend
    expect(screen.queryByText('Elsewhere')).toBeInTheDocument();
  });

  it('says when there were too few presses, and explains many omissions', async () => {
    renderResults({ pathname: '/results/s2', state: { session: neverPressed } });
    expect(await screen.findByRole('group', { name: '3s held back' })).toHaveTextContent('9 of 9');
    expect(tile('Typical response time')).toHaveTextContent('Not enough presses to measure');
    expect(tile('How much your timing varied')).toHaveTextContent('Not enough presses to measure');
    expect(screen.getByText(/many digits pass without pressing/i)).toBeInTheDocument();
  });

  it('ends with a primary way home and a secondary way to progress', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    await screen.findByRole('group', { name: '3s held back' });
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(within(main).getByRole('link', { name: 'See your progress' })).toHaveAttribute(
      'href',
      '/progress',
    );
  });

  it('loads the session by URL when there is no navigation state', async () => {
    const backend = renderResults('/results/s1');
    expect(await screen.findByRole('group', { name: '3s held back' })).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).toContain('listSessions');
  });

  it("does not show the previous player's session after switching player", async () => {
    // Two players on this device; Ana has just finished s1 (Play hands it over in the state).
    saveProfiles(localStorage, {
      profiles: [
        { id: 'ana', name: 'Ana', token: tokenN(1) },
        { id: 'ben', name: 'Ben', token: tokenN(2) },
      ],
      activeId: 'ana',
    });
    renderResults(
      { pathname: '/results/s1', state: { session: mixed, playerId: 'ana' } },
      undefined,
      (b) => {
        b.names.set(tokenN(1), 'Ana'); // the names on the server (Spec 013)
        b.names.set(tokenN(2), 'Ben');
      },
    );
    expect(await screen.findByRole('group', { name: '3s held back' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Player: Ana' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Ben' }));

    // Same URL and navigation state, but Ben has no sessions.
    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '3s held back' })).toBeNull();
  });

  it('shows "Session not found" for an id the player does not have', async () => {
    renderResults('/results/someone-else');
    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /session journey/i })).toBeNull();
    // The shared status page: a reason, a primary and a secondary action.
    const page = screen.getByRole('region', { name: 'Session not found' });
    expect(page).toHaveTextContent(/does not belong to the current player/i);
    expect(within(page).getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(within(page).getByRole('link', { name: 'See your progress' })).toHaveAttribute(
      'href',
      '/progress',
    );
  });

  it('keeps each tile to the number and a plain name; the research terms are in About these measures', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    await screen.findByRole('group', { name: '3s held back' });
    // The count sits on the number's line, not on a line of its own.
    expect(within(tile('3s held back')).getByTestId('value')).toHaveTextContent(/^89%\s*8 of 9$/);
    for (const name of ['3s held back', 'How much your timing varied', 'Typical response time'])
      expect(tile(name)).not.toHaveTextContent(/catch rate|rhythm variability|median response/i);

    // A disclosure, closed at first, that works by click or tap (no hover needed).
    const about = screen.getByText('About these measures').closest('details')!;
    expect(about).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('About these measures'));
    expect(about).toHaveAttribute('open');
    expect(about).toHaveTextContent(/3s held back.*catch rate \(1 − commission errors\)/i);
    expect(about).toHaveTextContent(/digits missed.*omission errors/i);
    expect(about).toHaveTextContent(/typical response time.*median response time/i);
    expect(about).toHaveTextContent(/how much your timing varied.*rhythm variability \(RT CV\)/i);
    expect(about).toHaveTextContent(/longest steady run/i);
  });
});

describe('Results: the conclusion and comparisons', () => {
  /** Earlier sessions with one score each, oldest first, as the API lists them. */
  const before = (n: number, score: Partial<CompletedSession['score']>) =>
    Array.from({ length: n }, (_, i) => storedSession(100 + i, score));
  const usual = { commissionRate: 0.3, omissionRate: 0.05, medianGoRtMs: 400, rtCv: 0.2 };
  /** Waits for the history to load: the conclusion is blank until then. */
  const expectConclusion = (text: string | RegExp) =>
    waitFor(() => expect(screen.getByTestId('conclusion')).toHaveTextContent(text));

  it('is neutral after the first session', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } }, [mixed]);
    await expectConclusion(
      'Your first full check is done. It is for getting used to the pace, so it does not count toward your starting point. Your starting point is built from your next 5 checks.',
    );
    expect(screen.queryByTestId('change')).toBeNull();
    // The player has just done the practice round: this full check is never called practice.
    expect(screen.getByRole('main')).not.toHaveTextContent(/practice/i);
  });

  it('counts digits missed, and compares with a count too', async () => {
    // Baseline: 4 of the 72 digits missed in each of sessions 2–6; this session: 7.
    const target = storedSession(7, { ...usual, omissions: 7, omissionRate: 7 / 72 });
    renderResults({ pathname: '/results/s7', state: { session: target } }, [
      ...before(6, { ...usual, omissions: 4, omissionRate: 4 / 72 }),
      target,
    ]);
    await expectConclusion(/below at catching every digit|Below where you started/);
    const missed = tile('Digits missed');
    expect(within(missed).getByTestId('value')).toHaveTextContent(/^7$/);
    expect(within(missed).getByTestId('change')).toHaveTextContent('More missed · 4 before');
    expect(missed).not.toHaveTextContent('%');
  });

  it('compares with where you started once the baseline exists, with arrows and words', async () => {
    // Sessions 1–6 make the baseline (2–6); `mixed` is session 7.
    renderResults({ pathname: '/results/s1', state: { session: mixed } }, [
      ...before(6, usual),
      mixed,
    ]);
    await expectConclusion(
      'Better than where you started at holding back on 3s, catching every digit and keeping an even rhythm.',
    );
    // Catch rate 93% against 70%: up, better, in words as well as colour.
    const held = within(tile('3s held back')).getByTestId('change');
    expect(held).toHaveAttribute('data-verdict', 'better');
    expect(held).toHaveTextContent('↑');
    expect(held).toHaveTextContent('More held back');
    expect(held).toHaveTextContent('70% before');
    expect(within(tile('Digits missed')).getByTestId('change')).toHaveTextContent('Fewer missed');
    expect(within(tile('Typical response time')).getByTestId('change')).toHaveTextContent(
      'Similar',
    );
    expect(screen.getByText(/compared with where you started/i)).toBeInTheDocument();
  });

  it('says plainly what was below the baseline, and calls speed only faster or slower', async () => {
    const target = storedSession(7, {
      commissionRate: 0.4,
      omissionRate: 0.1,
      medianGoRtMs: 350,
      rtCv: 0.3,
    });
    renderResults({ pathname: '/results/s7', state: { session: target } }, [
      ...before(6, { commissionRate: 0.1, omissionRate: 0.02, medianGoRtMs: 400, rtCv: 0.2 }),
      target,
    ]);
    await expectConclusion(
      'Below where you started at holding back on 3s, catching every digit and keeping an even rhythm.',
    );
    const held = within(tile('3s held back')).getByTestId('change');
    expect(held).toHaveAttribute('data-verdict', 'worse');
    expect(held).toHaveTextContent('↓');
    expect(held).toHaveTextContent('Fewer held back');
    const speed = within(tile('Typical response time')).getByTestId('change');
    expect(speed).toHaveAttribute('data-verdict', 'changed');
    expect(speed).toHaveTextContent('Faster');
  });

  it('compares with the earlier checks before the baseline exists', async () => {
    // Session 4: compared with sessions 2 and 3 (session 1 does not count).
    renderResults({ pathname: '/results/s1', state: { session: mixed } }, [
      ...before(3, usual),
      mixed,
    ]);
    await expectConclusion(/^Better than your last 2 checks at/);
    expect(screen.getByText(/compared with your last 2 checks/i)).toBeInTheDocument();
  });
});

describe('Results: the session journey in three parts', () => {
  it('splits the trials into a labelled start, middle and end', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    const ribbon = await screen.findByRole('img', { name: /session journey/i });
    const parts = within(ribbon).getAllByTestId('segment');
    expect(parts.map((p) => p.dataset.label)).toEqual(['Start', 'Middle', 'End']);
    for (const p of parts) expect(within(p).getAllByTestId('trial')).toHaveLength(27);
    expect(parts[0]).toHaveTextContent('Start');
    // The text alternative keeps the overall summary and adds each part.
    expect(ribbon.getAttribute('aria-label')).toMatch(/81 trials.*Start: .*Middle: .*End: /);
  });

  it('lists only what happened in this session in the legend', async () => {
    renderResults({ pathname: '/results/s2', state: { session: neverPressed } });
    const legend = await screen.findByTestId('legend');
    // Never pressing: every 3 held back and every other digit missed.
    expect(legend).toHaveTextContent('Held back on a 3');
    expect(legend).toHaveTextContent('Missed a digit');
    expect(legend).not.toHaveTextContent('Pressed on a 3');
    expect(legend).not.toHaveTextContent('Too early');
    expect(legend).not.toHaveTextContent('Steady press');
  });
});

describe('Results: the game first (Spec 006 §4)', () => {
  it('shows points, longest streak and dawn for a game session', async () => {
    const game = { ...mixed, id: 'g1', variant: 'game' as const };
    renderResults({ pathname: '/results/g1', state: { session: game } }, [game]);
    const block = await screen.findByRole('region', { name: 'Your game' });
    // Points from the outcomes by hand (Spec 006 §2), the same walk as `best` below.
    const points = game.score.trialOutcomes.reduce(
      (acc, o) => {
        if (o !== 'steady' && o !== 'caught') return { streak: 0, total: acc.total };
        const streak = acc.streak + 1;
        const mult = streak >= 30 ? 5 : streak >= 15 ? 3 : streak >= 5 ? 2 : 1;
        return { streak, total: acc.total + (o === 'caught' ? 30 : 10) * mult };
      },
      { streak: 0, total: 0 },
    ).total;
    expect(block).toHaveTextContent(`${points} points`);
    expect(block).toHaveTextContent(`Longest streak: ${game.score.longestSteadyRun}`);
    // Dawn = points ÷ the points of an all-correct session, rounded down.
    const best = plan.trials.reduce(
      (acc, t) => {
        const streak = acc.streak + 1;
        const mult = streak >= 30 ? 5 : streak >= 15 ? 3 : streak >= 5 ? 2 : 1;
        return { streak, total: acc.total + (t.isTarget ? 30 : 10) * mult };
      },
      { streak: 0, total: 0 },
    ).total;
    expect(block).toHaveTextContent(`Dawn ${Math.floor((points / best) * 100)}%`);
  });

  it('shows no game block for a calm session', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    await screen.findByRole('group', { name: '3s held back' });
    expect(screen.queryByRole('region', { name: 'Your game' })).toBeNull();
  });
});
