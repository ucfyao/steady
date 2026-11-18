import type { CompletedSession, TrialOutcome, Variant } from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';
import { storedSession } from './support/sessions.js';

// Spec 026: one background per group, and the light/dark choice on every screen.

afterEach(() => document.documentElement.removeAttribute('data-theme'));

/** k steady presses out of 10 digits; 6 of 10 is dawn 50% (80 of 160 points, worked by hand). */
const outcomes = (k: number): TrialOutcome[] =>
  Array.from({ length: 10 }, (_, i) => (i < k ? 'steady' : 'omission'));

function renderPlay(variant: Variant, opts: { sessions?: CompletedSession[] } = {}) {
  const backend = fakeBackend();
  backend.control.variant = variant;
  if (opts.sessions) backend.sessions.set(tokenN(1), opts.sessions);
  const clock = fakeEnv('keyboard');
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/play']}>
        <AppRoutes playEnv={clock.env} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const header = () => within(screen.getByRole('banner'));
const checkScene = () => screen.queryByTestId('page-scene');
const sceneDawn = () =>
  within(screen.getByTestId('page-scene')).getByTestId('scene').style.getPropertyValue('--dawn');
const panel = () => screen.queryByTestId('check-panel');
const howItWorks = () =>
  screen.findByRole('heading', { name: 'Catch every digit. Hold back on 3.' });
const beforeYouStart = () => screen.findByRole('list', { name: 'Before you start' });
const returning = [storedSession(1, {}, { variant: 'calm' })];

describe('the header on the check (Spec 026 §1)', () => {
  for (const variant of ['plain', 'calm', 'game'] as const) {
    it(`${variant}: Trends, the light/dark button and the avatar on How it works`, async () => {
      renderPlay(variant);
      await howItWorks();
      expect(header().getByRole('link', { name: 'Trends' })).toBeInTheDocument();
      expect(
        header().getByRole('button', { name: /^Switch to (light|dark)$/ }),
      ).toBeInTheDocument();
      expect(header().getByRole('button', { name: /^Player: / })).toBeInTheDocument();
    });

    it(`${variant}: the same header on Before you start`, async () => {
      renderPlay(variant, { sessions: returning });
      await beforeYouStart();
      expect(
        header().getByRole('button', { name: /^Switch to (light|dark)$/ }),
      ).toBeInTheDocument();
      expect(header().getByRole('button', { name: /^Player: / })).toBeInTheDocument();
    });
  }
});

describe("the check's background per group (Spec 026 §2)", () => {
  it('plain: no scene and no panel', async () => {
    renderPlay('plain');
    await howItWorks();
    expect(checkScene()).toBeNull();
    expect(panel()).toBeNull();
  });

  it('calm: the scene at night, the content in the panel', async () => {
    renderPlay('calm');
    const heading = await howItWorks();
    expect(checkScene()).not.toBeNull();
    expect(sceneDawn()).toBe('0.000');
    expect(panel()).toContainElement(heading);
  });

  it('calm, returning: the scene and the panel on Before you start', async () => {
    renderPlay('calm', { sessions: returning });
    const list = await beforeYouStart();
    expect(checkScene()).not.toBeNull();
    expect(panel()).toContainElement(list);
  });

  it("game: the scene at the dawn of the player's last game session", async () => {
    renderPlay('game', {
      sessions: [
        storedSession(1, { trialOutcomes: outcomes(10) }, { variant: 'game' }), // dawn 100%
        storedSession(2, { trialOutcomes: outcomes(6) }, { variant: 'game' }), // dawn 50%, last
        storedSession(3, { trialOutcomes: outcomes(10) }, { variant: 'calm' }), // not a game session
      ],
    });
    await beforeYouStart();
    expect(sceneDawn()).toBe('0.500');
    expect(panel()).not.toBeNull();
  });

  it('game without a game session: dawn 0', async () => {
    renderPlay('game');
    await howItWorks();
    expect(sceneDawn()).toBe('0.000');
  });

  it('the scene while the check loads, with the waiting state in the panel (Spec 028 §1)', async () => {
    const backend = fakeBackend();
    backend.control.variant = 'calm';
    // Hold the check's own requests, so the screen is up but the group has not arrived.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const factory: typeof backend.factory = ((token: string | null) => {
      const api = backend.factory(token);
      return {
        ...api,
        listSessions: async () => {
          await gate;
          return api.listSessions();
        },
      };
    }) as typeof backend.factory;
    const clock = fakeEnv('keyboard');
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/play']}>
          <AppRoutes playEnv={clock.env} />
        </MemoryRouter>
      </PlayersProvider>,
    );
    const waiting = await screen.findByText('Loading…');
    expect(checkScene()).not.toBeNull();
    expect(panel()).toContainElement(waiting);
    release();
    await howItWorks();
    expect(checkScene()).not.toBeNull();
  });

  it('the page no longer takes the night colours (Spec 015 §2 removed)', async () => {
    renderPlay('calm');
    await howItWorks();
    expect(screen.getByRole('banner').closest('[data-night]')).toBeNull();
  });

  it('calm: the light/dark button works on the check', async () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    renderPlay('calm');
    await howItWorks();
    await userEvent.click(header().getByRole('button', { name: 'Switch to dark' }));
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(header().getByRole('button', { name: 'Switch to light' })).toBeInTheDocument();
    expect(checkScene()).not.toBeNull();
  });

  it('leaving the check removes the scene', async () => {
    renderPlay('calm');
    await howItWorks();
    // Trends has no scene (Spec 028 §1); Home now has one for calm too.
    await userEvent.click(screen.getByRole('link', { name: 'Trends' }));
    await screen.findByRole('heading', { level: 1, name: 'Trends' });
    expect(checkScene()).toBeNull();
  });
});

describe('switching players on the check (the Spec 019 case)', () => {
  it('calm to plain and back: the scene follows the player, the header stays', async () => {
    const backend = fakeBackend();
    backend.addPlayer('Cleo', { variant: 'calm' });
    backend.addPlayer('Pat', { variant: 'plain' });
    const clock = fakeEnv('keyboard');
    render(
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/play']}>
          <AppRoutes playEnv={clock.env} />
        </MemoryRouter>
      </PlayersProvider>,
    );
    const pick = async (name: string) => {
      await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
      await userEvent.click(
        within(screen.getByRole('menu', { name: 'Player' })).getByRole('menuitemradio', { name }),
      );
    };

    await howItWorks();
    expect(checkScene()).not.toBeNull();

    await pick('Pat');
    await howItWorks();
    expect(checkScene()).toBeNull();
    expect(header().getByRole('button', { name: /^Switch to (light|dark)$/ })).toBeInTheDocument();

    await pick('Cleo');
    await howItWorks();
    expect(checkScene()).not.toBeNull();
    expect(header().getByRole('button', { name: /^Switch to (light|dark)$/ })).toBeInTheDocument();
  });
});
