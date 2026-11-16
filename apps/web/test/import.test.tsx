import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, type Api } from '../src/api/client.js';
import { AppRoutes } from '../src/App.js';
import { parseImportHash } from '../src/players/importLink.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { EMPTY, importProfile, loadProfiles, type Profile } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { storedSession } from './support/sessions.js';

const DEMO = tokenN(42);
const link = (hash: string) => `/import${hash}`;

/** Opens the app at an import link, the way a browser would: the hash is in the address bar. */
function openLink(path: string, backend = fakeBackend()) {
  window.history.replaceState(null, '', path);
  render(
    <StrictMode>
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>
    </StrictMode>,
  );
  return backend;
}

const names = () => loadProfiles(localStorage).profiles.map((p) => p.name);
// Profiles reach localStorage in an effect, which can run after the screen shows the result.
const expectNames = (expected: string[]) => waitFor(() => expect(names()).toEqual(expected));
const activeName = () => {
  const s = loadProfiles(localStorage);
  return s.profiles.find((p) => p.id === s.activeId)?.name;
};

afterEach(() => window.history.replaceState(null, '', '/'));

describe('parseImportHash', () => {
  it('reads the token and the name', () => {
    expect(parseImportHash(`#token=${DEMO}&name=Demo`)).toEqual({ token: DEMO, name: 'Demo' });
    expect(parseImportHash(`#name=Demo%20player&token=${DEMO}`)).toEqual({
      token: DEMO,
      name: 'Demo player',
    });
  });

  it('allows a missing name, but not a missing token', () => {
    expect(parseImportHash(`#token=${DEMO}`)).toEqual({ token: DEMO, name: '' });
    expect(parseImportHash('#name=Demo')).toBeNull();
    expect(parseImportHash('#token=&name=Demo')).toBeNull();
    expect(parseImportHash('')).toBeNull();
  });
});

describe('importProfile', () => {
  const alex: Profile = { id: 'a', name: 'Alex', token: 'A'.repeat(43) };
  const demo: Profile = { id: 'd', name: 'Demo', token: DEMO };

  it('adds a new player and makes it active', () => {
    expect(importProfile({ profiles: [alex], activeId: 'a' }, demo)).toEqual({
      profiles: [alex, demo],
      activeId: 'd',
    });
    expect(importProfile(EMPTY, demo)).toEqual({ profiles: [demo], activeId: 'd' });
  });

  it('switches to a player this device already has, keeping its name', () => {
    const renamed = { ...demo, name: 'My demo' };
    const s = { profiles: [renamed, alex], activeId: 'a' };
    expect(importProfile(s, { id: 'new', name: 'Demo', token: DEMO })).toEqual({
      profiles: [renamed, alex],
      activeId: 'd',
    });
  });
});

describe('import link', () => {
  it('checks the token, adds the player, clears the hash and opens Progress', async () => {
    const backend = fakeBackend();
    backend.sessions.set(DEMO, [storedSession(1), storedSession(2)]);
    openLink(link(`#token=${DEMO}&name=Demo`), backend);

    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Player: Demo' })).toBeInTheDocument();
    expect(backend.calls).toContainEqual({ token: DEMO, method: 'listSessions' });
    await expectNames(['Player 1', 'Demo']);
    expect(activeName()).toBe('Demo');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(DEMO);
  });

  it('does not add the same player twice', async () => {
    openLink(link(`#token=${DEMO}&name=Demo`));
    await screen.findByRole('button', { name: 'Player: Demo' });
    await expectNames(['Player 1', 'Demo']);
    window.history.replaceState(null, '', '/');
    // Switch away, then open the same link again.
    const s = loadProfiles(localStorage);
    localStorage.setItem(
      'steady.players.v1',
      JSON.stringify({ ...s, activeId: s.profiles[0]!.id }),
    );
    cleanup();

    openLink(link(`#token=${DEMO}&name=Demo`));
    expect(await screen.findByRole('button', { name: 'Player: Demo' })).toBeInTheDocument();
    await expectNames(['Player 1', 'Demo']);
  });

  it('explains an unknown token, adds nothing and still clears the hash', async () => {
    const backend = fakeBackend();
    backend.unauthorized.add(DEMO);
    openLink(link(`#token=${DEMO}&name=Demo`), backend);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/doesn.t match a player/i);
    expect(screen.getByRole('heading', { name: "Couldn't import this player" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    await expectNames(['Player 1']);
    expect(activeName()).toBe('Player 1');
    expect(window.location.hash).toBe('');
  });

  it('explains a link without a token', async () => {
    const backend = openLink(link('#name=Demo'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/incomplete/i);
    expect(backend.calls.map((c) => c.method)).not.toContain('listSessions');
    await expectNames(['Player 1']);
  });

  it('says so when the server cannot be reached', async () => {
    const backend = fakeBackend();
    const factory = (token: string | null): Api => {
      const api = backend.factory(token);
      return token === DEMO
        ? {
            ...api,
            listSessions: () =>
              Promise.reject(new ApiError('network', 'Could not reach the server.')),
          }
        : api;
    };
    window.history.replaceState(null, '', link(`#token=${DEMO}`));
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter initialEntries={[link(`#token=${DEMO}`)]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await expectNames(['Player 1']);
  });
});
