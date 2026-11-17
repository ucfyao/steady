import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend } from './support/fake-api.js';

// Spec 011: in development, each player's own group in the player menu and Manage players.
// The groups come with the shared list of players (Spec 014).

function renderApp(opts: { devTools?: boolean; path?: string } = {}) {
  const backend = fakeBackend();
  backend.addPlayer('Ana', { variant: 'plain' });
  backend.addPlayer('Ben', { variant: 'game' });
  backend.addPlayer('Cy', { variant: 'calm' });
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[opts.path ?? '/']}>
        <AppRoutes devTools={opts.devTools} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Player: Ana' }));
  return within(screen.getByRole('menu', { name: 'Player' }));
}
const item = (menu: Awaited<ReturnType<typeof openMenu>>, name: string) =>
  menu.getByRole('menuitemradio', { name: new RegExp(`^${name}\\b`) });

describe('Player groups in development (Spec 011)', () => {
  it('shows no group without the development flag', async () => {
    renderApp();
    const menu = await openMenu();
    expect(item(menu, 'Ana')).toHaveTextContent(/^Ana$/);
    expect(item(menu, 'Ben')).toHaveTextContent(/^Ben$/);
  });

  it("shows each player's own group in the player menu", async () => {
    renderApp({ devTools: true });
    const menu = await openMenu();
    expect(await within(item(menu, 'Ana')).findByText('plain')).toBeInTheDocument();
    expect(await within(item(menu, 'Ben')).findByText('game')).toBeInTheDocument();
    expect(await within(item(menu, 'Cy')).findByText('calm')).toBeInTheDocument();
  });

  it("shows each player's own group on Manage players", async () => {
    renderApp({ devTools: true, path: '/players' });
    await screen.findByRole('heading', { level: 1, name: 'Players' });
    const row = (name: string) =>
      within(screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!);
    expect(await row('Ana').findByText('plain')).toBeInTheDocument();
    expect(await row('Ben').findByText('game')).toBeInTheDocument();
    expect(await row('Cy').findByText('calm')).toBeInTheDocument();
  });

  it('reads the groups from the one list of players, with no call per player (Spec 014)', async () => {
    const backend = renderApp({ devTools: true });
    await openMenu();
    await screen.findByText('game');
    // Only the selected player's own screens ask for it (Home); nothing per player.
    const ana = backend.registry[0]!.token;
    expect(backend.calls.filter((c) => c.method === 'getMe' && c.token !== ana)).toEqual([]);
    expect(backend.calls.filter((c) => c.method === 'listPlayers').length).toBeGreaterThan(0);
  });

  it('has no bottom-left badge any more', async () => {
    renderApp({ devTools: true });
    await screen.findByRole('button', { name: 'Player: Ana' });
    expect(screen.queryByRole('complementary', { name: 'Dev: version' })).toBeNull();
  });

  it('lets a new player be created in a chosen group (Spec 011 §3)', async () => {
    const backend = renderApp({ devTools: true, path: '/players' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    const group = dialog.getByRole('combobox', { name: 'Group' });
    expect(
      within(group)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Random', 'plain', 'calm', 'game']);
    expect(group).toHaveValue('');
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.selectOptions(group, 'calm');
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    expect(backend.createdWith.at(-1)).toEqual({ name: 'Sam', variant: 'calm' });
    const menu = await openMenu();
    expect(await within(item(menu, 'Sam')).findByText('calm')).toBeInTheDocument();
  });

  it('sends no group for Random, and has no Group choice without the flag', async () => {
    const backend = renderApp({ devTools: true, path: '/players' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    let dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    expect(backend.createdWith.at(-1)).toEqual({ name: 'Player 4' }); // no group: the server draws it
    cleanup();

    renderApp({ path: '/players' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    expect(dialog.queryByRole('combobox', { name: 'Group' })).toBeNull();
  });
});
