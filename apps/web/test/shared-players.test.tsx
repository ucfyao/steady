import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { ACTIVE_KEY } from '../src/players/store.js';
import { fakeBackend } from './support/fake-api.js';

// Spec 016: one list of players on the server, for everyone; the browser keeps only the selection.

type Backend = ReturnType<typeof fakeBackend>;

function renderApp(backend: Backend, path = '/') {
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

function withAvaAndBen() {
  const backend = fakeBackend();
  const ava = backend.addPlayer('Ava');
  const ben = backend.addPlayer('Ben');
  return { backend, ava, ben };
}

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
  return within(screen.getByRole('menu', { name: 'Player' }));
}

const selected = () => localStorage.getItem(ACTIVE_KEY);

describe('Shared player list (Spec 016)', () => {
  it('shows the server’s players in the menu and selects the first, creating nobody', async () => {
    const { backend } = withAvaAndBen();
    renderApp(backend);
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
    const menu = await openMenu();
    expect(menu.getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(['Ava', 'Ben']);
    expect(backend.createdWith).toEqual([]);
  });

  it('shows every player on Manage players', async () => {
    const { backend } = withAvaAndBen();
    backend.addPlayer('Cleo');
    renderApp(backend, '/players');
    await screen.findByRole('heading', { level: 1, name: 'Players' });
    for (const name of ['Ava', 'Ben', 'Cleo']) expect(await screen.findByText(name)).toBeVisible();
    expect(screen.getByText(/everyone using steady sees every player/i)).toBeInTheDocument();
  });

  it('remembers the selected player, and uses their token for the screens', async () => {
    const { backend, ben } = withAvaAndBen();
    renderApp(backend, '/progress');
    await userEvent.click((await openMenu()).getByRole('menuitemradio', { name: 'Ben' }));
    expect(await screen.findByRole('button', { name: 'Player: Ben' })).toBeInTheDocument();
    await waitFor(() => expect(selected()).toBe(ben.id));
    await waitFor(() =>
      expect(backend.calls).toContainEqual({ token: ben.token, method: 'listSessions' }),
    );

    cleanup();
    renderApp(backend);
    expect(await screen.findByRole('button', { name: 'Player: Ben' })).toBeInTheDocument();
  });

  it('falls back to the first player when the selected one is not in the list', async () => {
    const { backend, ava } = withAvaAndBen();
    localStorage.setItem(ACTIVE_KEY, 'not-a-player');
    renderApp(backend);
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
    await waitFor(() => expect(selected()).toBe(ava.id));
  });

  it('creates "Player 1" when there are no players at all', async () => {
    const backend = renderApp(fakeBackend());
    expect(await screen.findByRole('button', { name: 'Player: Player 1' })).toBeInTheDocument();
    expect(backend.createdWith).toEqual([{ name: 'Player 1' }]);
  });

  it('adds a player on the server and reads the list again, keeping the selection', async () => {
    const { backend } = withAvaAndBen();
    renderApp(backend, '/players');
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Sam')).toBeInTheDocument();
    expect(backend.createdWith).toEqual([{ name: 'Sam' }]);
    expect(screen.getByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
  });

  it('deleting the selected player selects the first one left', async () => {
    const { backend, ava, ben } = withAvaAndBen();
    localStorage.setItem(ACTIVE_KEY, ben.id);
    renderApp(backend, '/players');
    await screen.findByRole('button', { name: 'Player: Ben' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Ben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything for Ben' }));
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
    expect(backend.registry.map((r) => r.id)).toEqual([ava.id]);
    await waitFor(() => expect(selected()).toBe(ava.id));
  });

  it('reads the list again when the selected player was deleted elsewhere (401)', async () => {
    const { backend, ben } = withAvaAndBen();
    localStorage.setItem(ACTIVE_KEY, ben.id);
    // Deleted by someone else: gone from the list, and its token no longer works.
    backend.registry.splice(1, 1);
    backend.unauthorized.add(ben.token);
    renderApp(backend, '/progress');
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
  });

  it('says so and reads the list again when a request comes back 401', async () => {
    const { backend, ben } = withAvaAndBen();
    localStorage.setItem(ACTIVE_KEY, ben.id);
    renderApp(backend, '/');
    await screen.findByRole('button', { name: 'Player: Ben' });
    backend.registry.splice(1, 1);
    backend.unauthorized.add(ben.token);
    await userEvent.click(screen.getByRole('link', { name: 'Trends' }));
    expect(await screen.findByText('That player no longer exists.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
  });

  it('shows an error with Try again when the list cannot be read', async () => {
    const { backend } = withAvaAndBen();
    backend.control.failPlayersOnce = true;
    renderApp(backend);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Player: Ava' })).toBeInTheDocument();
  });
});
