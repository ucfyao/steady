import type { CompletedSession, TrialOutcome, Variant } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { dawnPercent, personalBest } from '../src/game/dawn.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

// Spec 007. Outcomes for 5 trials: 4 digits then a 3. All correct: 4 × 10 + 30 × 2 = 100
// points (Spec 006 §2), so a session's dawn is simply its points out of 100 here.
const FIVE: TrialOutcome[] = ['steady', 'steady', 'steady', 'steady', 'caught'];

const daysAgo = (d: number) => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - d, 12);
};
const game = (n: number, points: number, ago = 10 - n) =>
  storedSession(n, { points, trialOutcomes: FIVE }, { variant: 'game', completedAt: daysAgo(ago) });

function renderAt(path: string, sessions: CompletedSession[], variant: Variant = 'calm') {
  const backend = fakeBackend();
  backend.control.variant = variant;
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

describe('dawnPercent and personalBest', () => {
  it('is 100 for a perfect session, rounds down, and 0 without points', () => {
    expect(dawnPercent({ points: 100, trialOutcomes: FIVE })).toBe(100);
    expect(dawnPercent({ points: 49.9, trialOutcomes: FIVE })).toBe(49);
    expect(dawnPercent({ points: 0, trialOutcomes: FIVE })).toBe(0);
    expect(dawnPercent({ points: 0, trialOutcomes: [] })).toBe(0);
  });

  it('takes the largest points of game sessions only', () => {
    const calm = storedSession(9, { points: 9999 });
    expect(personalBest([game(1, 40), game(2, 70), calm])).toBe(70);
    expect(personalBest([calm])).toBeNull();
  });
});

describe('Home (Spec 007 §1)', () => {
  it('opens on a hero with the greeting, the lead and the start button', async () => {
    renderAt('/', []);
    const hero = await screen.findByRole('region', { name: "Today's check" });
    expect(within(hero).getByRole('heading', { name: 'Hi, Player 1' })).toBeInTheDocument();
    expect(hero).toHaveTextContent('Two minutes. Catch every digit, hold back on 3.');
    expect(within(hero).getByRole('link', { name: "Start today's check" })).toHaveAttribute(
      'href',
      '/play',
    );
    expect(within(hero).getByTestId('scene')).toBeInTheDocument();
  });

  it('draws the week as seven lanterns, played ones lit', async () => {
    renderAt('/', [storedSession(1, {}, { completedAt: daysAgo(0) })]);
    const week = await screen.findByRole('region', { name: 'Last 7 days' });
    const days = within(week).getAllByTestId('week-day');
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toHaveAttribute('data-played', 'true');
    for (const d of days) expect(within(d).getByTestId('lantern-icon')).toBeInTheDocument();
  });

  it('for a game player: the personal best and the last sky', async () => {
    renderAt('/', [game(1, 40), game(2, 90), game(3, 60, 0)], 'game');
    const last = await screen.findByRole('region', { name: 'Last check · Today' });
    expect(within(last).getByRole('group', { name: 'Personal best' })).toHaveTextContent(
      '90 points',
    );
    const hero = screen.getByRole('region', { name: "Today's check" });
    expect(hero).toHaveTextContent('Last sky: dawn 60%');
    expect(within(hero).getByTestId('scene').style.getPropertyValue('--dawn')).toBe('0.600');
  });

  it('for a calm player: no personal best and no last sky', async () => {
    renderAt('/', [storedSession(1, {}, { completedAt: daysAgo(0) })], 'calm');
    const last = await screen.findByRole('region', { name: 'Last check · Today' });
    expect(within(last).queryByRole('group', { name: 'Personal best' })).toBeNull();
    expect(screen.queryByText(/Last sky/)).toBeNull();
  });
});

describe('Results: personal best (Spec 007 §2)', () => {
  const open = async (target: CompletedSession, history: CompletedSession[]) => {
    renderAt(`/results/${target.id}`, history, 'game');
    return screen.findByRole('region', { name: 'Your game' });
  };

  it('says New personal best when the points beat every earlier game session', async () => {
    const t = game(3, 95, 0);
    expect(await open(t, [game(1, 40), game(2, 90), t])).toHaveTextContent('New personal best');
  });

  it('not for a tie, the first game session, or below the best', async () => {
    const tie = game(3, 90, 0);
    expect(await open(tie, [game(1, 40), game(2, 90), tie])).not.toHaveTextContent(
      'New personal best',
    );
  });

  it('not for the first game session', async () => {
    const first = game(1, 90, 0);
    expect(await open(first, [first])).not.toHaveTextContent('New personal best');
  });
});

describe('Progress: your skies (Spec 007 §3)', () => {
  it('shows one sky per game session, newest first, each linking to its Results', async () => {
    renderAt('/progress', [game(1, 40), game(2, 90), game(3, 60, 0)], 'game');
    const skies = await screen.findByRole('region', { name: 'Your skies' });
    const links = within(skies).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/results/s3',
      '/results/s2',
      '/results/s1',
    ]);
    expect(links[0]).toHaveAccessibleName('Session 3: dawn 60%, 60 points');
    expect(links[0]).toHaveTextContent('60%');
    expect(links[0]).toHaveTextContent('60 pts');
  });

  it('shows the latest 12, with Show all', async () => {
    const many = Array.from({ length: 14 }, (_, i) => game(i + 1, 10 * i, 14 - i));
    renderAt('/progress', many, 'game');
    const skies = await screen.findByRole('region', { name: 'Your skies' });
    expect(within(skies).getAllByRole('link')).toHaveLength(12);
    fireEvent.click(within(skies).getByRole('button', { name: 'Show all 14' }));
    expect(await within(skies).findAllByRole('link')).toHaveLength(14);
  });

  it('has no skies for a calm player', async () => {
    renderAt('/progress', [storedSession(1), storedSession(2)], 'calm');
    await screen.findByRole('heading', { name: 'Progress' });
    expect(screen.queryByRole('region', { name: 'Your skies' })).toBeNull();
  });
});
