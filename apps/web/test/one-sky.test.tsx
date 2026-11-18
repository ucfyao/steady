import type { CompletedSession, TrialOutcome, Variant } from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { GROUP_KEY } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

// Spec 028: one sky behind the page, on every screen of a group.

/** k steady presses out of 10 digits; 6 of 10 is dawn 50% (80 of 160 points, worked by hand). */
const outcomes = (k: number): TrialOutcome[] =>
  Array.from({ length: 10 }, (_, i) => (i < k ? 'steady' : 'omission'));

function renderAt(
  entry: string | { pathname: string; state: unknown },
  variant: Variant,
  sessions: CompletedSession[] = [],
  backend = fakeBackend(),
) {
  backend.control.variant = variant;
  backend.sessions.set(tokenN(1), sessions);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[entry]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const pageScene = () => screen.queryByTestId('page-scene');
const sceneDawn = () =>
  within(screen.getByTestId('page-scene')).getByTestId('scene').style.getPropertyValue('--dawn');
const layout = () => screen.getByRole('banner').parentElement!;
const hero = () => screen.findByRole('region', { name: "Today's check" });

describe('Home (Spec 028 §2)', () => {
  it('calm: the scene behind the page at night, with the lantern', async () => {
    renderAt('/', 'calm');
    const h = await hero();
    expect(sceneDawn()).toBe('0.000');
    expect(within(h).queryByTestId('scene')).toBeNull(); // not inside the hero any more
    // The lantern is drawn for the eye only (Spec 014 §2).
    expect(within(h).getByTestId('hero-lantern')).toHaveAttribute('aria-hidden', 'true');
    expect(layout()).toHaveAttribute('data-scene');
  });

  it("game: the scene at the dawn of the player's last game session", async () => {
    renderAt('/', 'game', [
      storedSession(1, { trialOutcomes: outcomes(10) }, { variant: 'game' }), // dawn 100%
      storedSession(2, { trialOutcomes: outcomes(6) }, { variant: 'game' }), // dawn 50%, last
    ]);
    await screen.findByText('Last sky: dawn 50%');
    expect(sceneDawn()).toBe('0.500');
  });

  it('game without a game session: dawn 0', async () => {
    renderAt('/', 'game');
    await screen.findByRole('region', { name: 'What Steady does' });
    expect(sceneDawn()).toBe('0.000');
  });

  it('plain: no scene and no lantern, the greeting and the button stay', async () => {
    renderAt('/', 'plain');
    const h = await hero();
    await screen.findByRole('region', { name: 'What Steady does' });
    expect(pageScene()).toBeNull();
    expect(within(h).queryByTestId('hero-lantern')).toBeNull();
    expect(within(h).getByRole('heading', { name: 'Hi, Player 1' })).toBeInTheDocument();
    expect(within(h).getByRole('link', { name: "Start today's check" })).toBeInTheDocument();
    expect(layout()).not.toHaveAttribute('data-scene');
  });

  it('calm: the scene is there before the history arrives', async () => {
    const backend = fakeBackend();
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
    backend.control.variant = 'calm';
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    await screen.findByRole('status', { name: 'Loading your history' });
    expect(pageScene()).not.toBeNull();
    release();
    await screen.findByRole('region', { name: 'What Steady does' });
  });

  it('the header lies on the scene even while a notice is shown', async () => {
    const backend = renderAt('/', 'calm');
    await hero();
    // A second player whose key the server no longer knows: switching to it shows a notice.
    await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Manage players' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await screen.findByText('Sam', { selector: 'li *' });
    await userEvent.click(screen.getByRole('link', { name: 'Steady' }));
    backend.unauthorized.add(tokenN(2));
    await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Sam' }));
    await screen.findByRole('status');
    await hero();
    expect(pageScene()).not.toBeNull();
    expect(layout()).not.toHaveAttribute('data-over-hero');
  });

  it('no scene on Trends', async () => {
    renderAt('/progress', 'calm');
    await screen.findByRole('button', { name: /^Player: / });
    await screen.findByRole('heading', { level: 1 });
    expect(pageScene()).toBeNull();
  });
});

describe('Results (Spec 028 §3)', () => {
  const session = (variant: Variant, steady: number) =>
    storedSession(1, { trialOutcomes: outcomes(steady) }, { variant });
  const open = async (s: CompletedSession) => {
    renderAt({ pathname: `/results/${s.id}`, state: { session: s } }, s.variant, [s]);
    const band = await screen.findByRole('region', { name: 'Your sky' });
    expect(within(band).getByTestId('conclusion')).toBeInTheDocument();
    expect(within(band).queryByTestId('scene')).toBeNull();
  };

  it('a game session: the scene at its own dawn', async () => {
    await open(session('game', 6));
    expect(sceneDawn()).toBe('0.500');
  });

  it('a calm session: the scene at night', async () => {
    await open(session('calm', 6));
    expect(sceneDawn()).toBe('0.000');
  });

  it('a plain session: no scene', async () => {
    await open(session('plain', 6));
    expect(pageScene()).toBeNull();
    expect(layout()).not.toHaveAttribute('data-scene');
  });

  it('calm: the scene while the session loads, the waiting state on a panel', async () => {
    const backend = fakeBackend();
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
    const s = session('calm', 6);
    backend.control.variant = 'calm';
    backend.sessions.set(tokenN(1), [s]);
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={[`/results/${s.id}`]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    const waiting = await screen.findByText('Loading your results…');
    expect(sceneDawn()).toBe('0.000');
    expect(screen.getByTestId('results-panel')).toContainElement(waiting);
    release();
    await screen.findByRole('region', { name: 'Your sky' });
    expect(sceneDawn()).toBe('0.000');
  });

  it('calm: the scene stays when the session is not found, the message on a panel', async () => {
    renderAt('/results/missing', 'calm');
    const title = await screen.findByRole('heading', { name: 'Session not found' });
    expect(pageScene()).not.toBeNull();
    expect(screen.getByTestId('results-panel')).toContainElement(title);
  });

  it('plain: no scene and no panel when the session is not found', async () => {
    renderAt('/results/missing', 'plain');
    await screen.findByRole('heading', { name: 'Session not found' });
    expect(pageScene()).toBeNull();
    expect(screen.queryByTestId('results-panel')).toBeNull();
  });

  it('no scene after leaving for Trends', async () => {
    const s = session('calm', 6);
    renderAt({ pathname: `/results/${s.id}`, state: { session: s } }, 'calm', [s]);
    await screen.findByRole('region', { name: 'Your sky' });
    await userEvent.click(screen.getByRole('link', { name: 'See your trends' }));
    await screen.findByRole('heading', { level: 1, name: 'Trends' });
    expect(pageScene()).toBeNull();
  });
});

describe('opening the app (Spec 028 §1)', () => {
  /** Holds the player list, so the layout stays on "Setting up…" until `release`. */
  function renderHeld(remembered?: string) {
    if (remembered) localStorage.setItem(GROUP_KEY, remembered);
    const backend = fakeBackend();
    backend.control.variant = 'calm';
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const factory: typeof backend.factory = ((token: string | null) => {
      const api = backend.factory(token);
      return {
        ...api,
        listPlayers: async () => {
          await gate;
          return api.listPlayers();
        },
      };
    }) as typeof backend.factory;
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    return () => release();
  }

  it('the group remembered in this browser: its scene while setting up, the text on a panel', async () => {
    const release = renderHeld('calm');
    const waiting = await screen.findByText('Setting up…');
    expect(sceneDawn()).toBe('0.000');
    expect(screen.getByTestId('layout-panel')).toContainElement(waiting);
    release();
    await hero();
    expect(pageScene()).not.toBeNull();
  });

  it('plain remembered: no scene and no panel while setting up', async () => {
    renderHeld('plain');
    await screen.findByText('Setting up…');
    expect(pageScene()).toBeNull();
    expect(screen.queryByTestId('layout-panel')).toBeNull();
  });

  it('nothing (or nonsense) remembered: no scene while setting up', async () => {
    renderHeld('purple');
    await screen.findByText('Setting up…');
    expect(pageScene()).toBeNull();
  });

  it("remembers the selected player's group once the list arrives", async () => {
    renderAt('/', 'game');
    await hero();
    expect(localStorage.getItem(GROUP_KEY)).toBe('game');
  });
});
