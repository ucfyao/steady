import type { Variant } from '@steady/core';
/**
 * Players (Spec 016): the list is on the server, for everyone. This browser remembers only which
 * player is selected, by id.
 */
export interface Profile {
  id: string;
  name: string;
  token: string;
}

export const ACTIVE_KEY = 'steady.activePlayer.v1';
/** The selected player's group, for the scene while the list loads (Spec 028). */
export const GROUP_KEY = 'steady.activeGroup.v1';
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

/** The group remembered for the selected player, or null when none is stored or readable. */
export function loadGroup(storage: Storage): Variant | null {
  try {
    const v = storage.getItem(GROUP_KEY);
    return v === 'plain' || v === 'calm' || v === 'game' ? v : null;
  } catch {
    return null;
  }
}

export function saveGroup(storage: Storage, group: Variant | null): void {
  try {
    if (group) storage.setItem(GROUP_KEY, group);
    else storage.removeItem(GROUP_KEY);
  } catch {
    // Blocked storage: the scene simply waits for the list next time.
  }
}

export function normaliseName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed || fallback;
}
