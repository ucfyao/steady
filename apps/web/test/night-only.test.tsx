import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { fakeBackend } from './support/fake-api.js';

function renderApp(path: string) {
  render(
    <PlayersProvider apiFactory={fakeBackend().factory} storage={localStorage}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
}

/** Spec 019: one look, the night. No light/dark choice anywhere. */
describe('one look (Spec 019)', () => {
  it.each(['/', '/progress', '/players', '/play'])(
    'has no light/dark button on %s',
    async (path) => {
      renderApp(path);
      await screen.findByRole('button', { name: /^Player: / });
      expect(screen.queryByRole('button', { name: /switch to (light|dark)/i })).toBeNull();
    },
  );

  it.each(['light', 'dark'])('ignores a stored %s choice from Spec 012', async (choice) => {
    localStorage.setItem('steady.theme.v1', choice);
    renderApp('/');
    await screen.findByRole('button', { name: /^Player: / });
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});
