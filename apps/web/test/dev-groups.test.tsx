import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { saveProfiles } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';

// Spec 011: in development, each player's own group in the player menu and Manage players.

function renderApp(opts: { devTools?: boolean; path?: string } = {}) {
  saveProfiles(localStorage, {
    profiles: [
      { id: 'ana', name: 'Ana', token: tokenN(1) },
      { id: 'ben', name: 'Ben', token: tokenN(2) },
      { id: 'cy', name: 'Cy', token: tokenN(3) },
    ],
    activeId: 'ana',
  });
  const backend = fakeBackend();
  backend.variants.set(tokenN(1), 'plain');
  backend.variants.set(tokenN(2), 'game');
  backend.meFails.add(tokenN(3)); // Cy's group cannot be read
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
    // Cy's group could not be read: the name alone.
    expect(item(menu, 'Cy')).toHaveTextContent(/^Cy$/);
  });

  it("shows each player's own group on Manage players", async () => {
    renderApp({ devTools: true, path: '/players' });
    await screen.findByRole('heading', { level: 1, name: 'Players' });
    const row = (name: string) =>
      within(screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!);
    expect(await row('Ana').findByText('plain')).toBeInTheDocument();
    expect(await row('Ben').findByText('game')).toBeInTheDocument();
    expect(row('Cy').queryByText(/^(plain|calm|game)$/)).toBeNull();
  });

  it('asks each player with their own token', async () => {
    const backend = renderApp({ devTools: true });
    await openMenu();
    await screen.findByText('game');
    const asked = backend.calls.filter((c) => c.method === 'getMe').map((c) => c.token);
    expect(new Set(asked)).toEqual(new Set([tokenN(1), tokenN(2), tokenN(3)]));
  });

  it('has no bottom-left badge any more', async () => {
    renderApp({ devTools: true });
    await screen.findByRole('button', { name: 'Player: Ana' });
    expect(screen.queryByRole('complementary', { name: 'Dev: version' })).toBeNull();
  });
});
