import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { StatusPage } from '../src/ui/StatusPage.js';
import { fakeBackend } from './support/fake-api.js';

describe('StatusPage', () => {
  it('shows a title, the reason, a primary and a secondary action', () => {
    render(
      <MemoryRouter>
        <StatusPage
          title="Something happened"
          primary={{ label: 'Do it again', onClick: () => {} }}
          secondary={{ label: 'Back to home', to: '/' }}
        >
          Here is why.
        </StatusPage>
      </MemoryRouter>,
    );
    const page = screen.getByRole('region', { name: 'Something happened' });
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent('Something happened');
    expect(page).toHaveTextContent('Here is why.');
    expect(within(page).getByRole('button', { name: 'Do it again' })).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});

describe('Unknown address', () => {
  it('shows "Page not found" inside the normal layout, with a way home', async () => {
    const backend = fakeBackend();
    render(
      <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
        <MemoryRouter initialEntries={['/nope']}>
          <AppRoutes />
        </MemoryRouter>
      </PlayersProvider>,
    );
    const page = await screen.findByRole('region', { name: 'Page not found' });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(within(page).getByRole('link', { name: 'See your trends' })).toHaveAttribute(
      'href',
      '/progress',
    );
  });
});
