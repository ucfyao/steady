/**
 * Players (Spec 014): the list is on the server, for everyone. This browser remembers only which
 * player is selected, by id.
 */
export interface Profile {
  id: string;
  name: string;
  token: string;
}

export const ACTIVE_KEY = 'steady.activePlayer.v1';
const MAX_NAME = 30;

/** The selected player's id, or null when none is stored or storage cannot be read. */
export function loadActiveId(storage: Storage): string | null {
  try {
    return storage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(storage: Storage, id: string | null): void {
  try {
    if (id) storage.setItem(ACTIVE_KEY, id);
    else storage.removeItem(ACTIVE_KEY);
  } catch {
    // Blocked storage: the selection lasts only until the page is reloaded.
  }
}

export function normaliseName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed || fallback;
}
