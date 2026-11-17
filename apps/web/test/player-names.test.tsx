import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend } from './support/fake-api.js';

// Spec 013: a player's name is stored on the server; with Spec 016 the list itself is too.

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

function anaAndBen() {
  const backend = fakeBackend();
  const ana = backend.addPlayer('Ana');
  const ben = backend.addPlayer('Ben');
  return { backend, ana, ben };
}

async function renameBen(to: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Rename Ben' }));
  const field = screen.getByRole('textbox', { name: /name/i });
  await userEvent.clear(field);
  await userEvent.type(field, to);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
}

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

  it('renames on the server with that player’s own token, and shows the server’s name', async () => {
    const { backend, ben } = anaAndBen();
    renderApp(backend, '/players');
    await renameBen('  Benji ');
    expect(await screen.findByText('Benji')).toBeInTheDocument();
    expect(backend.updated).toEqual([{ token: ben.token, name: '  Benji ' }]);
    expect(screen.queryByText('Ben')).toBeNull();
  });

  it('keeps the old name and says so when a rename fails', async () => {
    const { backend, ben } = anaAndBen();
    backend.control.failUpdateOnce = true;
    renderApp(backend, '/players');
    await renameBen('Benji');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(backend.names.get(ben.token)).toBe('Ben');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Benji')).toBeNull();
  });
});
