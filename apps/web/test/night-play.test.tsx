import type { CompletedSession, Variant } from '@steady/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

// Spec 015: the whole check in each group's look.

function renderPlay(variant: Variant, opts: { returning?: boolean; override?: Variant } = {}) {
  const backend = fakeBackend();
  backend.control.variant = variant;
  if (opts.returning) backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]);
  const clock = fakeEnv('keyboard', opts.override);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes playEnv={clock.env} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const night = () => screen.getByRole('banner').closest('[data-night]');
const nightScene = () => screen.queryByTestId('night-scene');
const howItWorks = () =>
  screen.findByRole('heading', { name: 'Catch every digit. Hold back on 3.' });
const beforeYouStart = () => screen.findByRole('list', { name: 'Before you start' });

describe("the check in each group's look (Spec 015)", () => {
  for (const variant of ['calm', 'game'] as const) {
    it(`${variant}: night on How it works and on Before you start`, async () => {
      renderPlay(variant);
      await howItWorks();
      expect(night()).not.toBeNull();
      expect(nightScene()).not.toBeNull();
    });

    it(`${variant}, returning: night on Before you start`, async () => {
      renderPlay(variant, { returning: true });
      await beforeYouStart();
      expect(night()).not.toBeNull();
      expect(nightScene()).not.toBeNull();
    });
  }

  it('plain: paper, no scene', async () => {
    renderPlay('plain');
    await howItWorks();
    expect(night()).toBeNull();
    expect(nightScene()).toBeNull();
  });

  it('plain, returning: paper on Before you start', async () => {
    renderPlay('plain', { returning: true });
    await beforeYouStart();
    expect(night()).toBeNull();
  });

  it('an override decides the look', async () => {
    renderPlay('calm', { override: 'plain' });
    await howItWorks();
    expect(night()).toBeNull();
  });

  it('paper while the check loads', async () => {
    renderPlay('calm');
    // Straight after the first render, before the player's group has arrived.
    expect(night()).toBeNull();
    await howItWorks();
    expect(night()).not.toBeNull();
  });

  it('leaving the check ends the night look', async () => {
    renderPlay('calm');
    await howItWorks();
    await userEvent.click(screen.getByRole('link', { name: 'Steady' }));
    await screen.findByRole('region', { name: "Today's check" });
    expect(night()).toBeNull();
    expect(nightScene()).toBeNull();
  });
});
