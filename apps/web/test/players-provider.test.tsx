import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError, type Api } from '../src/api/client.js';
import { PlayersContext, PlayersProvider } from '../src/players/PlayersProvider.js';
import { STORAGE_KEY, loadProfiles } from '../src/players/store.js';
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
      <button onClick={() => ctx.deleteActive()}>delete</button>
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
    expect(loadProfiles(localStorage).profiles).toHaveLength(1);
  });

  it('reuses stored players without creating a new one', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profiles: [{ id: 'a', name: 'Alex', token: tokenN(9) }], activeId: 'a' }),
    );
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('status: ready');
    expect(screen.getByText('active: Alex')).toBeInTheDocument();
    expect(backend.created()).toBe(0);
  });

  it('adds a player, makes it active, and switches back', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('active: Sam');
    expect(screen.getByText('players: Player 1, Sam')).toBeInTheDocument();
    expect(screen.getByText(`token: ${tokenN(2)}`)).toBeInTheDocument();

    await userEvent.click(screen.getByText('first'));
    expect(screen.getByText('active: Player 1')).toBeInTheDocument();
  });

  it('uses the active token for API calls', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('active: Sam');
    await userEvent.click(screen.getByText('list'));
    expect(backend.calls.at(-1)).toEqual({ token: tokenN(2), method: 'listSessions' });
  });

  it('removes a player the server no longer knows (401) and says so', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add')); // Sam, token 2
    await screen.findByText('active: Sam');
    backend.unauthorized.add(tokenN(2));

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
    await screen.findByText('active: Sam');
    backend.unauthorized.add(tokenN(2));

    // Home and Progress make two calls at once; both fail for the same player.
    await userEvent.click(screen.getByText('list2'));
    await screen.findByText('active: Player 1');
    expect(
      screen.getByText(
        'notice: That player no longer exists on the server, so it was removed from this device.',
      ),
    ).toBeInTheDocument();
  });

  it('merges several removed players into one notice', async () => {
    const backend = fakeBackend();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profiles: [
          { id: 'a', name: 'Alex', token: tokenN(7) },
          { id: 'b', name: 'Bo', token: tokenN(8) },
          { id: 'c', name: 'Cy', token: tokenN(9) },
        ],
        activeId: 'a',
      }),
    );
    backend.unauthorized.add(tokenN(7));
    backend.unauthorized.add(tokenN(8));
    renderWith(backend);
    await screen.findByText('active: Alex');
    await userEvent.click(screen.getByText('list'));
    await screen.findByText('active: Bo');
    await userEvent.click(screen.getByText('list'));
    await screen.findByText('active: Cy');
    expect(
      screen.getByText(
        'notice: 2 players no longer exist on the server and were removed from this device.',
      ),
    ).toBeInTheDocument();
  });

  it('deletes the active player on the server and on this device', async () => {
    const backend = fakeBackend();
    renderWith(backend);
    await screen.findByText('active: Player 1');
    await userEvent.click(screen.getByText('add'));
    await screen.findByText('active: Sam');

    await userEvent.click(screen.getByText('delete'));
    await screen.findByText('active: Player 1');
    expect(backend.calls).toContainEqual({ token: tokenN(2), method: 'deleteMe' });
    expect(loadProfiles(localStorage).profiles.map((p) => p.name)).toEqual(['Player 1']);
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
        createPlayer: async () => {
          if (fail) throw new ApiError('network', 'Could not reach the server.');
          return api.createPlayer();
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
