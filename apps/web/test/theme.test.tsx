import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App.js';
import { PlayersProvider } from '../src/players/PlayersProvider.js';
import { bootScript } from '../src/theme/boot.js';
import { applyTheme, readTheme, saveTheme } from '../src/theme/theme.js';
import { fakeBackend } from './support/fake-api.js';

/** Spec 012: Match system, Light or Dark, kept per browser. Key and values from the spec. */
const KEY = 'steady.theme.v1';
const root = document.documentElement;

afterEach(() => root.removeAttribute('data-theme'));

/** A Storage whose every call throws, like blocked site data. */
const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
} as unknown as Storage;

describe('theme storage', () => {
  it('reads Match system when nothing or something unknown is stored', () => {
    expect(readTheme(localStorage)).toBe('system');
    localStorage.setItem(KEY, 'sepia');
    expect(readTheme(localStorage)).toBe('system');
  });

  it('keeps Light and Dark, and forgets the key for Match system', () => {
    saveTheme(localStorage, 'dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(readTheme(localStorage)).toBe('dark');
    saveTheme(localStorage, 'light');
    expect(readTheme(localStorage)).toBe('light');
    saveTheme(localStorage, 'system');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('never throws when storage is blocked or missing', () => {
    expect(readTheme(blocked)).toBe('system');
    expect(() => saveTheme(blocked, 'dark')).not.toThrow();
    expect(readTheme(undefined)).toBe('system');
  });

  it('sets data-theme for Light and Dark and removes it for Match system', () => {
    applyTheme(root, 'dark');
    expect(root).toHaveAttribute('data-theme', 'dark');
    applyTheme(root, 'light');
    expect(root).toHaveAttribute('data-theme', 'light');
    applyTheme(root, 'system');
    expect(root).not.toHaveAttribute('data-theme');
  });
});

describe('the pre-paint script in index.html', () => {
  const run = () => new Function(bootScript())();

  it('applies the stored choice before the app starts', () => {
    localStorage.setItem(KEY, 'dark');
    run();
    expect(root).toHaveAttribute('data-theme', 'dark');
  });

  it('leaves the system in charge when nothing or something unknown is stored', () => {
    run();
    expect(root).not.toHaveAttribute('data-theme');
    localStorage.setItem(KEY, 'sepia');
    run();
    expect(root).not.toHaveAttribute('data-theme');
  });
});

function renderApp() {
  const backend = fakeBackend();
  render(
    <PlayersProvider apiFactory={backend.factory} storage={localStorage}>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </PlayersProvider>,
  );
}

/** A system colour scheme the test can change, as `matchMedia` reports it. */
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: 'change', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
  };
  window.matchMedia = vi.fn((q: string) =>
    q === '(prefers-color-scheme: dark)' ? query : { matches: false },
  ) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      dark = next;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

const toggle = () => screen.findByRole('button', { name: /^Switch to (dark|light)$/ });

describe('the light/dark button in the header', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('follows a light system until clicked, then keeps dark', async () => {
    fakeSystem(false);
    renderApp();
    const button = await toggle();
    expect(button).toHaveAccessibleName('Switch to dark');
    expect(root).not.toHaveAttribute('data-theme');

    await userEvent.click(button);
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(button).toHaveAccessibleName('Switch to light');

    await userEvent.click(button);
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(button).toHaveAccessibleName('Switch to dark');
  });

  it('offers light on a dark system, and follows the system while nothing is chosen', async () => {
    const system = fakeSystem(true);
    renderApp();
    const button = await toggle();
    expect(button).toHaveAccessibleName('Switch to light');
    system.set(false);
    expect(button).toHaveAccessibleName('Switch to dark');
  });

  it('keeps a stored choice whatever the system does', async () => {
    localStorage.setItem(KEY, 'dark');
    const system = fakeSystem(false);
    renderApp();
    const button = await toggle();
    expect(button).toHaveAccessibleName('Switch to light');
    system.set(true);
    system.set(false);
    expect(button).toHaveAccessibleName('Switch to light');
  });

  it('still switches the page when storage is blocked', async () => {
    fakeSystem(false);
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    renderApp();
    const button = await toggle();
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => blocked });
    try {
      await userEvent.click(button);
      expect(root).toHaveAttribute('data-theme', 'dark');
      expect(button).toHaveAccessibleName('Switch to light');
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('works without matchMedia, as light', async () => {
    renderApp();
    expect(await toggle()).toHaveAccessibleName('Switch to dark');
  });

  it('is no longer in the avatar menu', async () => {
    fakeSystem(false);
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
    const menu = screen.getByRole('menu', { name: 'Player' });
    expect(within(menu).queryByRole('group', { name: 'Appearance' })).toBeNull();
    expect(within(menu).queryByText('Dark')).toBeNull();
  });
});
