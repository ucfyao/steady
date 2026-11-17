import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { loadProfiles, saveProfiles } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';

// Spec 013: a player's name is stored on the server; the browser keeps only a cache of it.

function renderApp(backend = fakeBackend(), path = '/') {
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

/** Two players on this device, with these names on the server. */
function twoPlayers(server: { ana: string; ben: string }, cached = { ana: 'Ana', ben: 'Ben' }) {
  saveProfiles(localStorage, {
    profiles: [
      { id: 'ana', name: cached.ana, token: tokenN(101) },
      { id: 'ben', name: cached.ben, token: tokenN(102) },
    ],
    activeId: 'ana',
  });
  const backend = fakeBackend();
  backend.names.set(tokenN(101), server.ana);
  backend.names.set(tokenN(102), server.ben);
  return backend;
}

const cachedNames = () => loadProfiles(localStorage).profiles.map((p) => p.name);

describe('Player names on the server (Spec 013)', () => {
  it('sends the first player’s name when it is created', async () => {
    const backend = renderApp();
    expect(await screen.findByRole('button', { name: 'Player: Player 1' })).toBeInTheDocument();
    expect(backend.createdWith).toEqual([{ name: 'Player 1' }]);
  });

  it('sends a new player’s name from Add a player, or "Player N" when none is typed', async () => {
    const backend = renderApp(fakeBackend(), '/players');
    const add = async (name: string) => {
      await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
      if (name) await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), name);
      await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    };
    await add('Sam');
    await screen.findByText('Sam');
    await add('');
    await screen.findByText('Player 3');
    expect(backend.createdWith).toEqual([
      { name: 'Player 1' },
      { name: 'Sam' },
      { name: 'Player 3' },
    ]);
  });

  it('replaces the cached names with the server’s on load', async () => {
    const backend = twoPlayers({ ana: 'Anna', ben: 'Benji' });
    renderApp(backend);
    expect(await screen.findByRole('button', { name: 'Player: Anna' })).toBeInTheDocument();
    await waitFor(() => expect(cachedNames()).toEqual(['Anna', 'Benji']));
  });

  it('renames on the server with that player’s own token', async () => {
    const backend = twoPlayers({ ana: 'Ana', ben: 'Ben' });
    renderApp(backend, '/players');
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Ben' }));
    const field = screen.getByRole('textbox', { name: /name/i });
    await userEvent.clear(field);
    await userEvent.type(field, '  Benji ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Benji')).toBeInTheDocument();
    expect(backend.updated).toEqual([{ token: tokenN(102), name: '  Benji ' }]);
    await waitFor(() => expect(cachedNames()).toEqual(['Ana', 'Benji']));
  });

  it('keeps the old name and says so when a rename fails', async () => {
    const backend = twoPlayers({ ana: 'Ana', ben: 'Ben' });
    backend.control.failUpdateOnce = true;
    renderApp(backend, '/players');
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Ben' }));
    const field = screen.getByRole('textbox', { name: /name/i });
    await userEvent.clear(field);
    await userEvent.type(field, 'Benji');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(cachedNames()).toEqual(['Ana', 'Ben']);
    expect(backend.names.get(tokenN(102))).toBe('Ben');
  });

  it('takes an imported player’s name from the server, not from the link', async () => {
    const backend = fakeBackend();
    backend.names.set(tokenN(9), 'Ava');
    renderApp(backend, `/import#token=${tokenN(9)}&name=Someone`);
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
    expect(cachedNames()).toContain('Ava');
    expect(cachedNames()).not.toContain('Someone');
  });
});
