import type { CompletedSession } from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { saveProfiles } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

/** Spec 010: screen titles, waiting and error states. */

type Backend = ReturnType<typeof fakeBackend>;

/** Opens the app at `entry`; `wrap` can replace calls of the first player's api. */
function open(
  entry: string | { pathname: string; state: unknown },
  sessions: CompletedSession[],
  opts: { wrap?: (api: Api) => Partial<Api>; setup?: (b: Backend) => void } = {},
): Backend {
  const backend = fakeBackend();
  backend.sessions.set(tokenN(1), sessions);
  opts.setup?.(backend);
  const wrap = opts.wrap ?? (() => ({}));
  const factory = (token: string | null): Api => {
    const api = backend.factory(token);
    return token === tokenN(1) ? { ...api, ...wrap(api) } : api;
  };
  render(
    <PlayersProvider apiFactory={factory} storage={localStorage}>
      <MemoryRouter initialEntries={[entry]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const never = () => new Promise<never>(() => {});
const NETWORK = 'Could not reach Steady. Check your connection and try again.';
const SERVER = 'Something went wrong on our side. Try again in a moment.';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('Spec 010 §1: screen titles', () => {
  it('Progress keeps its name for screen readers only and leads with the summary', async () => {
    open('/progress', [storedSession(1)]);
    const summary = await screen.findByTestId('summary');
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toHaveClass(
      'visually-hidden',
    );
    expect(summary).toHaveClass('headline');
  });

  it('Progress with no sessions leads with the invitation', async () => {
    open('/progress', []);
    expect(await screen.findByText(/no sessions yet/i)).toHaveClass('headline');
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toHaveClass(
      'visually-hidden',
    );
  });

  it('Results leads with the conclusion, its name for screen readers only', async () => {
    const s1 = storedSession(1);
    open('/results/s1', [s1]);
    const conclusion = await screen.findByTestId('conclusion');
    expect(conclusion).toHaveClass('headline');
    expect(await screen.findByText(/your first full check is done/i)).toBe(conclusion);
    expect(screen.getByRole('heading', { level: 1, name: 'Session complete' })).toHaveClass(
      'visually-hidden',
    );
  });

  it('Results says "Session complete." while the history loads, never a blank line', async () => {
    const s1 = storedSession(1);
    saveProfiles(localStorage, {
      profiles: [{ id: 'ana', name: 'Ana', token: tokenN(1) }],
      activeId: 'ana',
    });
    open({ pathname: '/results/s1', state: { session: s1, playerId: 'ana' } }, [s1], {
      wrap: () => ({ listSessions: never }),
    });
    expect(await screen.findByTestId('conclusion')).toHaveTextContent(/^Session complete\.$/);
  });

  it('Results says "Session complete." when the history fails', async () => {
    const s1 = storedSession(1);
    saveProfiles(localStorage, {
      profiles: [{ id: 'ana', name: 'Ana', token: tokenN(1) }],
      activeId: 'ana',
    });
    open({ pathname: '/results/s1', state: { session: s1, playerId: 'ana' } }, [s1], {
      setup: (b) => (b.control.failListOnce = true),
    });
    expect(await screen.findByTestId('conclusion')).toHaveTextContent(/^Session complete\.$/);
  });
});

describe('Spec 010 §3: waiting', () => {
  it('Results waits with the shared status', async () => {
    open('/results/s1', [storedSession(1)], { wrap: () => ({ listSessions: never }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading your results…');
  });

  it('Progress waits with the shared status', async () => {
    open('/progress', [storedSession(1)], { wrap: () => ({ listSessions: never }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading your progress…');
  });

  it('Home keeps the space of its panels while the history loads', async () => {
    open('/', [storedSession(1)], { wrap: () => ({ listSessions: never }) });
    const reserved = await screen.findByRole('status', { name: 'Loading your history' });
    expect(reserved).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('region', { name: 'Last 7 days' })).toBeNull();
  });

  it('Home replaces the reserved panel with the history', async () => {
    open('/', [storedSession(1)]);
    expect(await screen.findByRole('region', { name: 'Last 7 days' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading your history' })).toBeNull();
  });

  it('Import waits with the shared status', async () => {
    const DEMO = tokenN(42);
    const backend = fakeBackend();
    const factory = (token: string | null): Api => {
      const api = backend.factory(token);
      return token === DEMO ? { ...api, listSessions: never } : api;
    };
    const path = `/import#token=${DEMO}&name=Demo`;
    window.history.replaceState(null, '', path);
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Checking the link…');
  });
});

describe('Spec 010 §3: errors in plain words', () => {
  it('Results that cannot load is a status page with Try again', async () => {
    open('/results/s1', [storedSession(1)], { setup: (b) => (b.control.failListOnce = true) });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Could not load this session' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(NETWORK);
    expect(screen.queryByText(/could not reach the server/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('group', { name: '3s held back' })).toBeInTheDocument();
  });

  it('Progress that cannot load is a status page, without the raw server message', async () => {
    open('/progress', [storedSession(1)], {
      setup: (b) => {
        b.control.failListOnce = true;
        b.control.failListKind = 'server';
      },
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Could not load your progress' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(SERVER);
    expect(screen.queryByText(/request failed/i)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('summary')).toBeInTheDocument();
  });

  it('Play that cannot get ready is a status page with Try again', async () => {
    open('/play', [storedSession(1)], { setup: (b) => (b.control.failListOnce = true) });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Could not get the check ready' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(NETWORK);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'How are you today?' })).toBeVisible();
  });

  it("Import's error is a status page", async () => {
    const DEMO = tokenN(42);
    const backend = fakeBackend();
    backend.unauthorized.add(DEMO);
    const path = `/import#token=${DEMO}&name=Demo`;
    window.history.replaceState(null, '', path);
    render(
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    const title = await screen.findByRole('heading', {
      level: 1,
      name: "Couldn't import this player",
    });
    // The shared status page: its round mark sits right before the title.
    expect(title.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(within(title.parentElement!).getByRole('alert')).toHaveTextContent(
      /doesn.t match a player/i,
    );
  });
});
