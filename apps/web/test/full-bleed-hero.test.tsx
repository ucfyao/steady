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

const overHero = () => screen.getByRole('banner').closest('[data-over-hero]');

describe('Home: the scene across the whole width (Spec 013)', () => {
  it('lays the header on the scene on Home', async () => {
    renderApp('/');
    await screen.findByRole('region', { name: "Today's check" });
    expect(overHero()).not.toBeNull();
  });

  it('keeps the usual header elsewhere', async () => {
    renderApp('/progress');
    await screen.findByRole('button', { name: /^Player: / });
    expect(overHero()).toBeNull();
  });

  it('keeps the usual header while a notice is shown', async () => {
    const backend = fakeBackend();
    renderApp('/', backend);
    await screen.findByRole('region', { name: "Today's check" });
    // A second player whose key the server no longer knows: switching to it shows a notice.
    await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Manage players' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add a player' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add a player' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Name' }), 'Sam');
    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await screen.findByText('Sam', { selector: 'li *' });
    await userEvent.click(screen.getByRole('link', { name: 'Steady' }));
    backend.unauthorized.add(tokenN(2));
    await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Sam' }));
    await screen.findByRole('status');
    expect(overHero()).toBeNull();
  });

  it('draws a lantern that screen readers skip', async () => {
    renderApp('/');
    const hero = await screen.findByRole('region', { name: "Today's check" });
    const lantern = within(hero).getByTestId('hero-lantern');
    expect(lantern).toHaveAttribute('aria-hidden', 'true');
  });
});
