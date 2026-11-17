import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { loadProfiles } from '../src/players/store.js';
import { storedSession } from './support/sessions.js';
import { fakeBackend, tokenN } from './support/fake-api.js';

function renderApp(path = '/', backend = fakeBackend()) {
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return backend;
}

const avatar = (name: string) => screen.findByRole('button', { name: `Player: ${name}` });

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
  return screen.getByRole('menu', { name: 'Player' });
}

async function openPlayers() {
  await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Manage players' }));
  return screen.findByRole('heading', { level: 1, name: 'Players' });
}

/** Adds a player from Manage players (which it leaves open); the active player stays the same. */
async function addPlayer(name: string) {
  await openPlayers();
  await userEvent.click(screen.getByRole('button', { name: 'Add a player' }));
  // Scoped to the dialog: jsdom does not make the page behind a modal inert.
  const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
  await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), name);
  await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
  await screen.findByText(name, { selector: 'li *' });
}

async function switchTo(name: string) {
  await userEvent.click(within(await openMenu()).getByRole('menuitemradio', { name }));
}

const goHome = () => userEvent.click(screen.getByRole('link', { name: 'Steady' }));

const row = (name: string) => within(screen.getByText(name, { selector: 'li *' }).closest('li')!);

describe('layout and player menu', () => {
  it("shows the active player's initial and switches players", async () => {
    renderApp();
    const button = await avatar('Player 1');
    expect(button).toHaveTextContent('P');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();

    await addPlayer('Sam');
    await goHome();
    await switchTo('Sam');
    expect(await avatar('Sam')).toHaveTextContent('S');
    expect(await screen.findByRole('heading', { name: 'Hi, Sam' })).toBeInTheDocument();

    const menu = await openMenu();
    expect(screen.getByRole('button', { name: 'Player: Sam' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(within(menu).getByRole('menuitemradio', { name: 'Sam' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(menu).getByRole('menuitemradio', { name: 'Player 1' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Player 1' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Hi, Player 1' })).toBeInTheDocument();
    expect(await avatar('Player 1')).toHaveFocus();
  });

  it('opens with focus on the active player, not the first one', async () => {
    renderApp();
    await addPlayer('Sam');
    await switchTo('Sam');
    await avatar('Sam');

    const menu = await openMenu();
    expect(within(menu).getByRole('menuitemradio', { name: 'Sam' })).toHaveFocus();
  });

  it('opens from the keyboard, moves with the arrow keys and closes on Escape', async () => {
    renderApp();
    const button = await avatar('Player 1');
    button.focus();

    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'Player' });
    const items = [
      ...within(menu).getAllByRole('menuitemradio'),
      ...within(menu).getAllByRole('menuitem'),
    ];
    expect(items.map((i) => i.textContent)).toEqual(['Player 1', 'Manage players']);
    expect(items[0]).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(items[0]).toHaveFocus(); // wraps around
    await userEvent.keyboard('{End}');
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(items[0]).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{ArrowUp}');
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Manage players' }),
    ).toHaveFocus();
  });

  it('closes when you click outside it or Tab away', async () => {
    renderApp();
    await openMenu();
    await userEvent.click(await screen.findByRole('heading', { name: 'Hi, Player 1' }));
    expect(screen.queryByRole('menu')).toBeNull();

    await openMenu();
    await userEvent.tab();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('links to Manage players', async () => {
    renderApp();
    expect(await openPlayers()).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows a notice as a dismissible bar, styled by its own module', async () => {
    const backend = renderApp();
    await addPlayer('Sam');
    await goHome();
    backend.unauthorized.add(tokenN(2));
    await switchTo('Sam');
    const bar = await screen.findByRole('status');
    expect(bar).toHaveTextContent('That player no longer exists on the server');
    expect(bar).not.toHaveClass('notice'); // not the old global class
    await userEvent.click(within(bar).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Manage players', () => {
  it('explains that the server holds the sessions and this browser holds the keys', async () => {
    renderApp('/players');
    await avatar('Player 1');
    expect(screen.getByRole('heading', { level: 1, name: 'Players' })).toBeVisible();
    expect(screen.getByText(/this browser holds the keys and the names/i)).toBeInTheDocument();
    expect(screen.getByText(/loses access to every player/i)).toBeInTheDocument();
  });

  it('lists every player here, marks the one playing now, and offers Rename and Delete on each', async () => {
    renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(row('Player 1').getByText('Playing now')).toBeInTheDocument();
    expect(row('Sam').queryByText('Playing now')).toBeNull();
    for (const name of ['Player 1', 'Sam']) {
      expect(row(name).getByRole('button', { name: `Rename ${name}` })).toBeInTheDocument();
      expect(row(name).getByRole('button', { name: `Delete ${name}` })).toBeInTheDocument();
    }
    // Switching stays in the avatar menu.
    expect(screen.queryByRole('button', { name: /switch/i })).toBeNull();
  });

  it('adds a player in a modal dialog and stays on the page, as the same player', async () => {
    const backend = renderApp('/players');
    await avatar('Player 1');
    await userEvent.click(screen.getByRole('button', { name: 'Add a player' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a player' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveFocus();

    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Sam', { selector: 'li *' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Players' })).toBeInTheDocument();
    expect(await avatar('Player 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a player' })).toHaveFocus();
    expect(backend.created()).toBe(2);
  });

  it('closes the dialog with Cancel or Escape and returns focus to Add a player', async () => {
    renderApp('/players');
    await avatar('Player 1');
    const add = screen.getByRole('button', { name: 'Add a player' });

    await userEvent.click(add);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(add).toHaveFocus();

    await userEvent.click(add);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(add).toHaveFocus();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('renames any player on this device only, then returns focus to Rename', async () => {
    const backend = renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');

    await userEvent.click(row('Sam').getByRole('button', { name: 'Rename Sam' }));
    const input = screen.getByRole('textbox', { name: 'New name for Sam' });
    expect(input).toHaveFocus();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '   ');
    expect(save).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'Alex');
    await userEvent.click(save);

    expect(screen.getByRole('button', { name: 'Rename Alex' })).toHaveFocus();
    expect(await avatar('Player 1')).toBeInTheDocument();
    expect(loadProfiles(localStorage).profiles.map((p) => p.name)).toEqual(['Player 1', 'Alex']);
    expect(backend.calls.map((c) => c.method)).not.toContain('rename');
  });

  it('renames the player playing now, which updates the avatar', async () => {
    renderApp('/players');
    await avatar('Player 1');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Player 1' }));
    const input = screen.getByRole('textbox', { name: 'New name for Player 1' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Jo{Enter}');
    expect(await avatar('Jo')).toBeInTheDocument();
  });

  it('cancels a rename with Escape and keeps the name', async () => {
    renderApp('/players');
    await avatar('Player 1');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Player 1' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New name for Player 1' }), 'xyz');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Rename Player 1' })).toHaveFocus();
    expect(screen.getByText('Player 1', { selector: 'li *' })).toBeInTheDocument();
  });

  it('opens one row at a time', async () => {
    renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Player 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Sam' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('group', { name: 'Delete all data for Sam' })).toBeInTheDocument();
  });

  it('asks before deleting; Cancel moves focus back to Delete', async () => {
    const backend = renderApp('/players');
    await avatar('Player 1');

    await userEvent.click(screen.getByRole('button', { name: 'Delete Player 1' }));
    const confirm = screen.getByRole('group', { name: 'Delete all data for Player 1' });
    expect(within(confirm).getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(
      within(confirm).getByRole('button', { name: /yes, delete everything/i }).className,
    ).toMatch(/danger/);

    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete Player 1' })).toHaveFocus();
    expect(backend.calls.map((c) => c.method)).not.toContain('deleteMe');
  });

  it("deletes another player with that player's own key and keeps the one playing now", async () => {
    const backend = renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');

    await userEvent.click(screen.getByRole('button', { name: 'Delete Sam' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything for Sam' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Sam's data was deleted/);
    expect(backend.calls).toContainEqual({ token: tokenN(2), method: 'deleteMe' });
    expect(backend.calls).not.toContainEqual({ token: tokenN(1), method: 'deleteMe' });
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(await avatar('Player 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Players' })).toHaveFocus();
  });

  it('deletes the player playing now and carries on as the next one', async () => {
    const backend = renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');

    await userEvent.click(screen.getByRole('button', { name: 'Delete Player 1' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Yes, delete everything for Player 1' }),
    );
    expect(await avatar('Sam')).toBeInTheDocument();
    expect(backend.calls).toContainEqual({ token: tokenN(1), method: 'deleteMe' });
    expect(row('Sam').getByText('Playing now')).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('closes an open confirmation when you switch player', async () => {
    renderApp('/players');
    await avatar('Player 1');
    await addPlayer('Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Sam' }));

    await switchTo('Sam');
    expect(await avatar('Sam')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /delete all data/i })).toBeNull();
  });
});

describe('switching player', () => {
  it("never shows the previous player's last check while the next one loads", async () => {
    const backend = fakeBackend();
    backend.sessions.set(tokenN(1), [storedSession(1), storedSession(2)]);
    // Sam's history never arrives, so a stale count from Player 1 would stay on screen.
    const factory = (token: string | null) => {
      const api = backend.factory(token);
      return token === tokenN(2)
        ? { ...api, listSessions: () => new Promise<never>(() => {}) }
        : api;
    };
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <MemoryRouter>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    expect(await screen.findByRole('region', { name: /^Last check · / })).toBeInTheDocument();

    await addPlayer('Sam');
    await goHome();
    await switchTo('Sam');
    expect(await screen.findByText('Hi, Sam')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Last check/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Last 7 days' })).toBeNull();
  });
});
