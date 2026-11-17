import type { CompletedSession, Variant } from '@steady/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend, tokenN } from './support/fake-api.js';
import { fakeEnv } from './support/fake-env.js';

// Spec 010: a development-only badge with the player's group, what is played, and links.

function renderApp(opts: {
  devTools?: boolean;
  group?: Variant;
  override?: Variant;
  path?: string;
}) {
  const backend = fakeBackend();
  backend.control.variant = opts.group ?? 'calm';
  // A returning player starts at the check-in; only Play reads this stand-in session.
  if (opts.path === '/play') backend.sessions.set(tokenN(1), [{ id: 'old' }] as CompletedSession[]);
  const clock = fakeEnv('keyboard', opts.override);
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={[opts.path ?? '/']}>
        <AppRoutes playEnv={clock.env} devTools={opts.devTools} />
      </MemoryRouter>
    </PlayersProvider>,
  );
  return { backend, clock };
}

const badge = () => screen.findByRole('complementary', { name: 'Dev: version' });

describe('Dev version badge (Spec 010)', () => {
  it('is not there without the development flag', async () => {
    renderApp({});
    await screen.findByRole('heading', { name: /^Hi, / });
    expect(screen.queryByRole('complementary', { name: 'Dev: version' })).toBeNull();
  });

  it("shows the player's group, what is played, and a link to each variant", async () => {
    renderApp({ devTools: true, group: 'game' });
    const b = await badge();
    expect(await within(b).findByText('Group: game')).toBeInTheDocument();
    expect(within(b).getByText('Playing: game')).toBeInTheDocument();
    for (const v of ['plain', 'calm', 'game'])
      expect(within(b).getByRole('link', { name: v })).toHaveAttribute(
        'href',
        `/play?variant=${v}`,
      );
    expect(within(b).getByRole('link', { name: 'game' })).toHaveAttribute('aria-current', 'true');
    expect(within(b).queryByRole('link', { name: 'Own group' })).toBeNull();
  });

  it('with an override: plays the override, marks it, and offers the own group', async () => {
    renderApp({ devTools: true, group: 'calm', override: 'plain' });
    const b = await badge();
    expect(await within(b).findByText('Group: calm')).toBeInTheDocument();
    expect(within(b).getByText('Playing: plain (override)')).toBeInTheDocument();
    expect(within(b).getByRole('link', { name: 'plain' })).toHaveAttribute('aria-current', 'true');
    expect(within(b).getByRole('link', { name: 'calm' })).not.toHaveAttribute('aria-current');
    expect(within(b).getByRole('link', { name: 'Own group' })).toHaveAttribute('href', '/play');
  });

  it('is hidden in focus mode', async () => {
    renderApp({ devTools: true, path: '/play' });
    await badge();
    await screen.findByRole('heading', { name: 'How are you today?' });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByTestId('countdown');
    expect(screen.queryByRole('complementary', { name: 'Dev: version' })).toBeNull();
  });

  it("shows the new player's group after a switch", async () => {
    const { backend } = renderApp({ devTools: true, group: 'calm' });
    expect(await within(await badge()).findByText('Group: calm')).toBeInTheDocument();
    backend.control.variant = 'plain'; // the next player the server creates
    const menu = async () => {
      await userEvent.click(screen.getByRole('button', { name: /^Player: / }));
      return within(screen.getByRole('menu', { name: 'Player' }));
    };
    await userEvent.click((await menu()).getByRole('menuitem', { name: 'Manage players' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await userEvent.click((await menu()).getByRole('menuitemradio', { name: 'Sam' }));
    expect(await within(await badge()).findByText('Group: plain')).toBeInTheDocument();
  });
});
