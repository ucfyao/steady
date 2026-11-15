import type { CompletedSession } from '@steady/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
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

const playerSelect = () => screen.findByRole('combobox', { name: 'Player' });

describe('layout and player menu', () => {
  it('shows the active player and lets you switch', async () => {
    renderApp();
    const select = await playerSelect();
    expect(select).toHaveDisplayValue('Player 1');

    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await playerSelect()).toHaveDisplayValue('Sam');

    await userEvent.selectOptions(await playerSelect(), 'Player 1');
    expect(await playerSelect()).toHaveDisplayValue('Player 1');
  });

  it('shows an error with a retry when the server cannot be reached', async () => {
    const backend = fakeBackend();
    backend.control.failCreate = true;
    renderApp('/', backend);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
    backend.control.failCreate = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await playerSelect()).toHaveDisplayValue('Player 1');
  });
});

describe('Home', () => {
  it("shows the goal and the active player's completed sessions", async () => {
    const backend = fakeBackend();
    backend.sessions.set(tokenN(1), [{ id: 'a' }, { id: 'b' }] as CompletedSession[]);
    renderApp('/', backend);
    expect(await screen.findByText(/Catch every 3, keep a steady rhythm/)).toBeInTheDocument();
    expect(await screen.findByText('Sessions completed: 2')).toBeInTheDocument();
  });
});

describe('Your data', () => {
  it('explains that history lives only on this device', async () => {
    renderApp('/data');
    await playerSelect();
    expect(screen.getByText(/no way to recover/i)).toBeInTheDocument();
    expect(screen.getByText(/never sent to the server/i)).toBeInTheDocument();
  });

  it('renames the active player on this device only', async () => {
    const backend = renderApp('/data');
    await playerSelect();
    const name = screen.getByRole('textbox', { name: 'Name on this device' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Alex');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await playerSelect()).toHaveDisplayValue('Alex');
    expect(backend.calls.map((c) => c.method)).not.toContain('rename');
  });

  it('deletes only after confirmation', async () => {
    const backend = renderApp('/data');
    await playerSelect();

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
    await playerSelect();
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await playerSelect()).toHaveDisplayValue('Sam');

    await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(await playerSelect()).toHaveDisplayValue('Player 1');

    expect(screen.queryByRole('button', { name: /yes, delete everything/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Name on this device' })).toHaveValue('Player 1');
  });

  it('closes an open confirmation when you switch player', async () => {
    renderApp('/data');
    await playerSelect();
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));

    await userEvent.selectOptions(await playerSelect(), 'Player 1');
    expect(screen.queryByRole('button', { name: /yes, delete everything/i })).toBeNull();
  });
});

describe('switching player', () => {
  it("never shows the previous player's session count while the next one loads", async () => {
    const backend = fakeBackend();
    backend.sessions.set(tokenN(1), [{ id: 'a' }, { id: 'b' }] as CompletedSession[]);
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

    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Hi, Sam')).toBeInTheDocument();
    expect(screen.queryByText(/Sessions completed/)).toBeNull();
  });
});
