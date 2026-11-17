import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
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

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /^Player: / }));
  return screen.getByRole('menu', { name: 'Player' });
}

const choice = (menu: HTMLElement, name: string) =>
  within(within(menu).getByRole('group', { name: 'Appearance' })).getByRole('menuitemradio', {
    name,
  });

describe('Appearance in the avatar menu', () => {
  it('offers Match system, Light and Dark, with Match system checked by default', async () => {
    renderApp();
    const menu = await openMenu();
    const group = within(menu).getByRole('group', { name: 'Appearance' });
    expect(
      within(group)
        .getAllByRole('menuitemradio')
        .map((i) => i.textContent),
    ).toEqual(['Match system', 'Light', 'Dark']);
    expect(choice(menu, 'Match system')).toHaveAttribute('aria-checked', 'true');
    expect(choice(menu, 'Dark')).toHaveAttribute('aria-checked', 'false');
  });

  it('applies and keeps Dark, then closes and returns focus to the avatar', async () => {
    renderApp();
    await userEvent.click(choice(await openMenu(), 'Dark'));
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /^Player: / })).toHaveFocus();
    expect(choice(await openMenu(), 'Dark')).toHaveAttribute('aria-checked', 'true');
  });

  it('Match system hands control back to the system', async () => {
    localStorage.setItem(KEY, 'light');
    root.setAttribute('data-theme', 'light');
    renderApp();
    const menu = await openMenu();
    expect(choice(menu, 'Light')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(choice(menu, 'Match system'));
    expect(root).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
