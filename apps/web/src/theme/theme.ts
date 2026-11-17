/**
 * Light or dark (Spec 012): Match system by default, or a choice kept in this browser for
 * every player. Storage can throw (a private window, blocked site data): then it is Match
 * system, and a choice lasts until the page is reloaded.
 */
export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
export const THEME_KEY = 'steady.theme.v1';

export function readTheme(storage: Storage | undefined): Theme {
  try {
    const stored = storage?.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(storage: Storage | undefined, theme: Theme): void {
  try {
    if (theme === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, theme);
  } catch {
    // Not kept: the choice still applies to this page.
  }
}

/** `data-theme` on `<html>` forces a scheme in tokens.css; without it the system decides. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
