import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
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

async function addPlayer(name: string) {
  await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Add player' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), name);
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));
}

async function switchTo(name: string) {
  await userEvent.click(within(await openMenu()).getByRole('menuitemradio', { name }));
}

describe('layout and player menu', () => {
  it("shows the active player's initial and lets you add and switch players", async () => {
    renderApp();
    const button = await avatar('Player 1');
    expect(button).toHaveTextContent('P');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();

    await addPlayer('Sam');
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
    expect(items.map((i) => i.textContent)).toEqual(['Player 1', 'Add player', 'Your data']);
    expect(items[0]).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(items[0]).toHaveFocus(); // wraps around
    await userEvent.keyboard('{End}');
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(items[0]).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{ArrowUp}');
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Your data' }),
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

  it('links to Your data', async () => {
    renderApp();
    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Your data' }));
    expect(await screen.findByRole('heading', { name: 'Your data' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('cancelling a new player returns focus to the menu button', async () => {
    renderApp();
    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Add player' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(await avatar('Player 1')).toHaveFocus();
  });

  it('shows an error with a retry when the server cannot be reached', async () => {
    const backend = fakeBackend();
    backend.control.failCreate = true;
    renderApp('/', backend);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
    backend.control.failCreate = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await avatar('Player 1')).toBeInTheDocument();
  });
});

describe('Home', () => {
  it("shows the goal and the active player's completed sessions", async () => {
    const backend = fakeBackend();
    backend.sessions.set(tokenN(1), [storedSession(1), storedSession(2)]);
    renderApp('/', backend);
    expect(await screen.findByText(/Catch every 3, keep a steady rhythm/)).toBeInTheDocument();
    expect(await screen.findByText('Sessions completed: 2')).toBeInTheDocument();
  });
});

describe('Your data', () => {
  it('explains that history lives only on this device', async () => {
    renderApp('/data');
    await avatar('Player 1');
    expect(screen.getByText(/no way to recover/i)).toBeInTheDocument();
    expect(screen.getByText(/never sent to the server/i)).toBeInTheDocument();
  });

  it('renames the active player on this device only', async () => {
    const backend = renderApp('/data');
    await avatar('Player 1');
    const name = screen.getByRole('textbox', { name: 'Name on this device' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Alex');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await avatar('Alex')).toBeInTheDocument();
    expect(backend.calls.map((c) => c.method)).not.toContain('rename');
  });

  it('deletes only after confirmation', async () => {
    const backend = renderApp('/data');
    await avatar('Player 1');

    await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
    const dialog = screen.getByRole('group', { name: /delete all data for player 1/i });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(backend.calls.map((c) => c.method)).not.toContain('deleteMe');

    await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/deleted/i);
    expect(backend.calls).toContainEqual({ token: tokenN(1), method: 'deleteMe' });
  });

  it("starts fresh for the next player: no open confirmation, and that player's name", async () => {
    renderApp('/data');
    await avatar('Player 1');
    await addPlayer('Sam');
    expect(await avatar('Sam')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(await avatar('Player 1')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /yes, delete everything/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Name on this device' })).toHaveValue('Player 1');
  });

  it('closes an open confirmation when you switch player', async () => {
    renderApp('/data');
    await avatar('Player 1');
    await addPlayer('Sam');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));

    await switchTo('Player 1');
    expect(screen.queryByRole('button', { name: /yes, delete everything/i })).toBeNull();
  });
});

describe('switching player', () => {
  it("never shows the previous player's session count while the next one loads", async () => {
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
    expect(await screen.findByText('Sessions completed: 2')).toBeInTheDocument();

    await addPlayer('Sam');
    expect(await screen.findByText('Hi, Sam')).toBeInTheDocument();
    expect(screen.queryByText(/Sessions completed/)).toBeNull();
  });
});
