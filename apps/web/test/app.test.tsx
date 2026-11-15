import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the shell while the first player is being created', () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole('link', { name: 'Steady' })).toBeInTheDocument();
    expect(screen.getByText('Setting up…')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
