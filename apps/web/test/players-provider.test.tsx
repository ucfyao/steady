import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError, type Api } from '../src/api/client.js';
import { PlayersContext, PlayersProvider } from '../src/players/PlayersProvider.js';
import { ACTIVE_KEY } from '../src/players/store.js';
import { fakeBackend, tokenN } from './support/fake-api.js';

function Probe() {
  const ctx = useContext(PlayersContext)!;
  return (
    <div>
      <p>status: {ctx.status}</p>
      <p>active: {ctx.active?.name ?? 'none'}</p>
      <p>token: {ctx.active?.token ?? 'none'}</p>
      <p>players: {ctx.profiles.map((p) => p.name).join(', ')}</p>
      <p>notice: {ctx.notice ?? 'none'}</p>
      <button onClick={() => ctx.addPlayer('Sam')}>add</button>
      <button onClick={() => ctx.switchTo(ctx.profiles[0]!.id)}>first</button>
      <button onClick={() => ctx.switchTo(ctx.profiles.at(-1)!.id)}>last</button>
      <button onClick={() => ctx.api!.listSessions().catch(() => {})}>list</button>
      <button
        onClick={() => {
          const api = ctx.api!;
          void api.listSessions().catch(() => {});
          void api.getProgress().catch(() => {});
        }}
      >
        list2
      </button>
      <button onClick={() => ctx.deletePlayer(ctx.active!.id)}>delete</button>
      <button onClick={() => ctx.deletePlayer(ctx.profiles[0]!.id)}>delete first</button>
    </div>
  );
}

const renderWith = (backend: ReturnType<typeof fakeBackend>) =>
  render(
    <StrictMode>
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <Probe />
      </PlayersProvider>
    </StrictMode>,
  );

describe('PlayersProvider', () => {
  it('creates exactly one player on a first visit, even under StrictMode', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('status: ready');
    expect(screen.getByText('active: Player 1')).toBeInTheDocument();
    expect(backend.created()).toBe(1);
    // Players are saved in an effect, which can run after the screen shows "ready".
    await waitFor(() => expect(localStorage.getItem(ACTIVE_KEY)).toBe(backend.registry[0]!.id));
    expect(backend.registry).toHaveLength(1);
  });

  it('uses the players on the server without creating a new one (Spec 016)', async () => {
    const backend = fakeBackend();
    backend.addPlayer('Alex', { token: tokenN(9) });
    backend.names.set(tokenN(9), 'Alex'); // the name on the server (Spec 013)
    renderWith(backend);
    await screen.findByText('status: ready');
    expect(screen.getByText('active: Alex')).toBeInTheDocument();
    expect(backend.created()).toBe(0);
  });

  it('adds a player without switching to it, then switches there and back', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('players: Player 1, Sam');
    expect(screen.getByText('active: Player 1')).toBeInTheDocument();

    await userEvent.click(screen.getByText('last'));
    expect(screen.getByText('active: Sam')).toBeInTheDocument();
    expect(screen.getByText(`token: ${tokenN(2)}`)).toBeInTheDocument();

    await userEvent.click(screen.getByText('first'));
    expect(screen.getByText('active: Player 1')).toBeInTheDocument();
  });

  it('uses the active token for API calls', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');
    await userEvent.click(screen.getByText('list'));
    expect(backend.calls.at(-1)).toEqual({ token: tokenN(2), method: 'listSessions' });
  });

  it('reads the list again when the selected player is gone (401), and says so', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add')); // Sam, token 2
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');
    backend.deleteElsewhere(tokenN(2));

    await userEvent.click(screen.getByText('list'));
    await screen.findByText('active: Player 1');
    expect(screen.getByText('players: Player 1')).toBeInTheDocument();
    expect(screen.getByText(/notice: .*no longer exists/)).toBeInTheDocument();
  });

  it('counts a player once when two calls fail for it', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add')); // Sam, token 2
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');
    backend.deleteElsewhere(tokenN(2));

    // Home and Progress make two calls at once; both fail for the same player.
    await userEvent.click(screen.getByText('list2'));
    await screen.findByText('active: Player 1');
    expect(screen.getByText('notice: That player no longer exists.')).toBeInTheDocument();
  });

  it('deletes the active player on the server, then selects the first one left', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');

    await userEvent.click(screen.getByText('delete'));
    await screen.findByText('active: Player 1');
    expect(backend.calls).toContainEqual({ token: tokenN(2), method: 'deleteMe' });
    expect(screen.getByText('players: Player 1')).toBeInTheDocument();
  });

  it('deletes another player with their own token and keeps the active one', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');

    await userEvent.click(screen.getByText('delete first'));
    await screen.findByText('players: Sam');
    expect(screen.getByText('active: Sam')).toBeInTheDocument();
    expect(backend.calls).toContainEqual({ token: tokenN(1), method: 'deleteMe' });
    expect(backend.calls).not.toContainEqual({ token: tokenN(2), method: 'deleteMe' });
    expect(
      screen.getByText('notice: Player 1 and their sessions were deleted.'),
    ).toBeInTheDocument();
  });

  it('drops a player from the list even if the server no longer knows it', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('players: Player 1, Sam');
    await userEvent.click(screen.getByText('last'));
    await screen.findByText('active: Sam');
    backend.deleteElsewhere(tokenN(1));

    await userEvent.click(screen.getByText('delete first'));
    await screen.findByText('players: Sam');
  });

  it('starts over as a new player after deleting the only one', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('delete'));
    await waitFor(() => expect(backend.created()).toBe(2));
    await screen.findByText(`token: ${tokenN(2)}`);
  });

  it('shows an error and can retry when the first player cannot be created', async () => {
    const backend = fakeBackend();
    let fail = true;
    const factory = (token: string | null): Api => {
      const api = backend.factory(token);
      return {
        ...api,
        createPlayer: async (body) => {
          if (fail) throw new ApiError('network', 'Could not reach the server.');
          return api.createPlayer(body);
        },
      };
    };
    render(
      <PlayersProvider apiFactory={factory} storage={localStorage}>
        <RetryProbe onRetry={() => (fail = false)} />
      </PlayersProvider>,
    );
    await screen.findByText('status: error');
    await act(async () => screen.getByText('retry').click());
    await screen.findByText('status: ready');
  });
});

function RetryProbe({ onRetry }: { onRetry: () => void }) {
  const ctx = useContext(PlayersContext)!;
  return (
    <div>
      <p>status: {ctx.status}</p>
      <button
        onClick={() => {
          onRetry();
          ctx.retry();
        }}
      >
        retry
      </button>
    </div>
  );
}
