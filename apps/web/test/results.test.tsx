import {
  createSessionPlan,
  scoreSession,
  type CompletedSession,
  type PlanTrial,
  type ProbeAnswer,
} from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';

const plan = createSessionPlan(7);
const targets = plan.trials.filter((t) => t.isTarget);
const gos = plan.trials.filter((t) => !t.isTarget && t.index > 10);
const COMMISSION = targets[2]!.index;
const OMISSION = gos[0]!.index;
const ANTICIPATION = gos[1]!.index;
const ANSWERS: ProbeAnswer[] = ['on_task', 'drifting', 'elsewhere', 'on_task'];

/** A stored session as the server returns it. Test code may score (it plays the server). */
function completed(id: string, rtFor: (t: PlanTrial) => number | null): CompletedSession {
  return {
    id,
    startedAt: '2026-11-16T09:00:00.000Z',
    completedAt: '2026-11-16T09:03:00.000Z',
    checkIn: null,
    device: 'keyboard',
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

function renderResults(entry: string | { pathname: string; state: unknown }) {
  const backend = fakeBackend();
  backend.sessions.set(tokenN(1), [mixed, neverPressed]);
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
    // From the spec: 14 targets per session, one of them pressed.
    expect(await screen.findByText('You caught 13 of 14 3s.')).toBeInTheDocument();
    expect(tile('Catch rate')).toHaveTextContent('93%');
    expect(tile('Median response')).toHaveTextContent('400 ms');
    expect(tile('Rhythm variability')).toHaveTextContent('0%');
    expect(tile('Missed digits')).toHaveTextContent('1');
    expect(tile('Longest steady run')).toHaveTextContent(`${mixed.score.longestSteadyRun} trials`);
    // Constant 400 ms is machine-like: the server raised regular_timing.
    expect(screen.getByText(/unusually even/i)).toBeInTheDocument();
  });

  it('draws one ribbon cell per trial with the server outcome, and marks the longest run', async () => {
    renderResults({ pathname: '/results/s1', state: { session: mixed } });
    const ribbon = await screen.findByRole('img', { name: /session journey/i });
    const cells = within(ribbon).getAllByTestId('trial');
    expect(cells).toHaveLength(126);
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
    expect(within(ribbon).getAllByTestId('probe')).toHaveLength(4);
    expect(screen.getByText('Drifting')).toBeInTheDocument(); // legend
  });

  it('says when there were too few presses, and explains many omissions', async () => {
    renderResults({ pathname: '/results/s2', state: { session: neverPressed } });
    expect(await screen.findByText('You caught 14 of 14 3s.')).toBeInTheDocument();
    expect(tile('Median response')).toHaveTextContent('Not enough presses to measure');
    expect(tile('Rhythm variability')).toHaveTextContent('Not enough presses to measure');
    expect(screen.getByText(/many digits pass without pressing/i)).toBeInTheDocument();
  });

  it('loads the session by URL when there is no navigation state', async () => {
    const backend = renderResults('/results/s1');
    expect(await screen.findByText('You caught 13 of 14 3s.')).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).toContain('listSessions');
  });

  it('shows "Session not found" for an id the player does not have', async () => {
    renderResults('/results/someone-else');
    expect(await screen.findByRole('heading', { name: 'Session not found' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /session journey/i })).toBeNull();
  });
});
