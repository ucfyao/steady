import type { CompletedSession, InputDevice, Variant } from '@steady/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

// Spec 020: one key style for the press hint; it moves only before the first digit.

function renderPlay(variant: Variant, device: InputDevice = 'keyboard', returning = true) {
  const backend = fakeBackend();
  backend.control.variant = variant;
  if (returning) backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]);
  const clock = fakeEnv(device);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes playEnv={clock.env} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return clock;
}

/** The keycap holding `label` inside `root`. */
function key(root: HTMLElement, label: string) {
  const keys = within(root)
    .getAllByText(label)
    .filter((el) => el.tagName === 'KBD');
  expect(keys).toHaveLength(1);
  return keys[0]!;
}
const moving = (el: HTMLElement) => el.dataset.moving === 'true';

async function startSession() {
  await screen.findByRole('heading', { name: 'How are you today?' });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  return screen.findByTestId('countdown');
}

const word = () => screen.getByTestId('countdown').querySelector('p')!.textContent;

describe('How it works', () => {
  it('shows Space as a moving key on a keyboard', async () => {
    renderPlay('plain', 'keyboard', false);
    const how = await screen.findByRole('region', { name: 'How to play' });
    expect(how).toHaveTextContent(/press space as soon as you see a digit/i);
    expect(moving(key(how, 'Space'))).toBe(true);
  });

  it('shows Tap as a moving key on a touch device', async () => {
    renderPlay('game', 'touch', false);
    const how = await screen.findByRole('region', { name: 'How to play' });
    expect(how).toHaveTextContent(/tap the screen as soon as you see a digit/i);
    expect(moving(key(how, 'Tap'))).toBe(true);
  });
});

describe('Countdown', () => {
  it('moves the key on Ready and Set, and stops it on Go', async () => {
    const clock = renderPlay('calm');
    const ring = await startSession();
    expect(ring).toHaveTextContent('Finger on Space');
    expect(word()).toBe('Ready');
    expect(moving(key(ring, 'Space'))).toBe(true);
    clock.advance(1100);
    expect(word()).toBe('Set');
    expect(moving(key(ring, 'Space'))).toBe(true);
    clock.advance(1000);
    expect(word()).toBe('Go');
    expect(moving(key(ring, 'Space'))).toBe(false);
  });

  it('holds "the screen" in the key on a touch device', async () => {
    renderPlay('game', 'touch');
    const ring = await startSession();
    expect(ring).toHaveTextContent('Finger on the screen');
    expect(moving(key(ring, 'the screen'))).toBe(true);
  });
});

describe('The rule line in the block', () => {
  it('shows a still key, with the same words, in practice and in the session', async () => {
    const clock = renderPlay('game', 'keyboard', false);
    fireEvent.click(await screen.findByRole('button', { name: 'Try a short practice' }));
    clock.advance(3100);
    const practice = screen.getByTestId('hint');
    expect(practice).toHaveTextContent('Practice · Space for every digit except 3');
    expect(moving(key(practice, 'Space'))).toBe(false);
  });

  it('is still in the session, and Tap on a touch device', async () => {
    const clock = renderPlay('plain', 'touch');
    await startSession();
    clock.advance(3100);
    const hint = screen.getByTestId('hint');
    expect(hint).toHaveTextContent('Tap for every digit except 3');
    expect(moving(key(hint, 'Tap'))).toBe(false);
  });

  it('never moves from the first digit to the last', async () => {
    const clock = renderPlay('game');
    await startSession();
    clock.advance(2100); // Go
    let moved = 0;
    clock.advance(20_000, 50, () => {
      if (document.querySelector('[data-moving="true"]')) moved++;
    });
    expect(moved).toBe(0);
  });
});

describe('Same for every group (Spec 008)', () => {
  it('draws the countdown key and the rule line with the same markup for plain, calm and game', async () => {
    const seen: string[] = [];
    for (const variant of ['plain', 'calm', 'game'] as const) {
      const clock = renderPlay(variant);
      const ring = await startSession();
      const countdownKey = key(ring, 'Space').outerHTML;
      clock.advance(3100);
      seen.push(`${countdownKey}|${screen.getByTestId('hint').outerHTML}`);
      cleanup();
      localStorage.clear();
    }
    expect(new Set(seen).size).toBe(1);
  });
});
