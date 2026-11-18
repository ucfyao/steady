import type { CompletedSession, Variant } from '@steady/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

// Spec 023: the practice track and the result card. Spec 024: the points rules (game).

function renderPlay(variant: Variant, returning = false) {
  const backend = fakeBackend();
  backend.control.variant = variant;
  if (returning) backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]);
  const clock = fakeEnv('keyboard');
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes playEnv={clock.env} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return clock;
}

const space = () => fireEvent.keyDown(window, { code: 'Space', key: ' ' });
// 3 s countdown + 4 × 2000 + 4 × 1500 + 4 × 1150 ms trials, 800 ms feedback each (Spec 005)
const PRACTICE_MS = 3000 + 4 * 2000 + 4 * 1500 + 4 * 1150 + 12 * 850 + 1000;

/** Presses 400 ms after every digit except 3; `onTarget(n)` may press on the n-th 3. */
function player(clock: ReturnType<typeof fakeEnv>, onTarget?: (n: number) => void) {
  let seen = -1;
  let threes = 0;
  let pressAt: number | null = null;
  return () => {
    const el = screen.queryByTestId('stimulus');
    const index = Number(el?.dataset.index ?? -1);
    const text = el?.textContent ?? '';
    if (el && index !== seen && /^\d$/.test(text)) {
      seen = index;
      pressAt = null;
      if (text === '3') onTarget?.(++threes);
      else pressAt = clock.now() + 400;
    }
    if (pressAt !== null && clock.now() >= pressAt) {
      space();
      pressAt = null;
    }
  };
}

const cells = (root: HTMLElement) =>
  within(root)
    .getAllByTestId('cell')
    .map((c) => c.dataset.outcome ?? 'pending');

async function startPractice() {
  fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));
}

describe('The practice track (Spec 023)', () => {
  it('starts with 12 empty cells and fills each one as its trial ends', async () => {
    const clock = renderPlay('game');
    await startPractice();
    expect(cells(screen.getByTestId('practice-track'))).toEqual(Array(12).fill('pending'));

    // The first digit (never a 3, Spec 005) is pressed: the first cell is a steady press.
    const play = player(clock, (n) => n === 1 && space()); // presses on the first 3 only
    clock.advance(3000 + 800 + 450, 50, play);
    expect(cells(screen.getByTestId('practice-track'))[0]).toBe('steady');

    clock.advance(PRACTICE_MS, 50, () => {
      if (screen.queryByTestId('practice-track')) play();
    });
    // The card after practice keeps the same cells: one 3 pressed, one held back, 10 steady.
    const card = screen.getByRole('region', { name: 'How the practice went' });
    const final = cells(card);
    expect(final).toHaveLength(12);
    expect(final.filter((o) => o === 'steady')).toHaveLength(10);
    expect(final.filter((o) => o === 'commission')).toHaveLength(1);
    expect(final.filter((o) => o === 'caught')).toHaveLength(1);
  });

  it('is not shown in the real session', async () => {
    const clock = renderPlay('calm', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByTestId('countdown');
    clock.advance(6000, 50);
    expect(screen.queryByTestId('practice-track')).toBeNull();
  });

  it('has the same markup for plain, calm and game', async () => {
    const seen = new Set<string>();
    for (const variant of ['plain', 'calm', 'game'] as const) {
      renderPlay(variant);
      await startPractice();
      seen.add(screen.getByTestId('practice-track').outerHTML);
      cleanup();
      localStorage.clear();
    }
    expect(seen.size).toBe(1);
  });
});

describe('The result card (Spec 023)', () => {
  it('shows the cells and the two numbers for a clean practice, and no Too early', async () => {
    const clock = renderPlay('plain');
    await startPractice();
    clock.advance(PRACTICE_MS, 50, player(clock));
    const card = screen.getByRole('region', { name: 'How the practice went' });
    expect(cells(card).filter((o) => o === 'steady')).toHaveLength(10);
    expect(cells(card).filter((o) => o === 'caught')).toHaveLength(2);
    expect(within(card).getByTestId('held-back')).toHaveTextContent('2 of 2');
    expect(within(card).getByTestId('held-back')).toHaveTextContent('3s held back');
    expect(within(card).getByTestId('caught')).toHaveTextContent('10 of 10');
    expect(within(card).getByTestId('caught')).toHaveTextContent('Digits caught');
    expect(within(card).queryByTestId('too-early')).toBeNull();
    // The legend lists only what happened.
    // (Hidden from screen readers, which get the one sentence.)
    const legend = within(card).getByTestId('legend');
    expect([...legend.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Steady press',
      'Held back on a 3',
    ]);
    expect(within(card).getByRole('note', { name: 'One tip' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Practice again' })).toBeInTheDocument();
  });
});

describe('The points rules (Spec 024)', () => {
  it('are on How it works for the game variant, with the numbers of Spec 006', async () => {
    renderPlay('game');
    const rules = await screen.findByTestId('points-rules');
    expect(rules).toHaveTextContent(
      'Points. 10 for each digit, 30 for each 3 you hold back. In a row they multiply: ×2 from 5, ×3 from 15, ×5 from 30. A slip restarts the streak; the points you have stay.',
    );
  });

  it.each(['plain', 'calm'] as const)('are not shown for %s', async (variant) => {
    renderPlay(variant);
    await screen.findByRole('region', { name: 'How to play' });
    expect(screen.queryByTestId('points-rules')).toBeNull();
  });
});
