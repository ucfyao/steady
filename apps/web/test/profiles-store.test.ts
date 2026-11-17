import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  STORAGE_KEY,
  activeProfile,
  addProfile,
  importProfile,
  loadProfiles,
  normaliseName,
  removeProfile,
  renameProfile,
  saveProfiles,
  switchProfile,
  type Profile,
} from '../src/players/store.js';

const alex: Profile = { id: 'a', name: 'Alex', token: 'A'.repeat(43) };
const sam: Profile = { id: 's', name: 'Sam', token: 'S'.repeat(43) };

describe('profile store', () => {
  it('starts empty, and treats missing or corrupt storage as empty', () => {
    expect(loadProfiles(localStorage)).toEqual(EMPTY);
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadProfiles(localStorage)).toEqual(EMPTY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles: [{ id: 1 }], activeId: 'x' }));
    expect(loadProfiles(localStorage)).toEqual(EMPTY);
  });

  it('round-trips through storage', () => {
    const state = addProfile(addProfile(EMPTY, alex), sam);
    saveProfiles(localStorage, state);
    expect(loadProfiles(localStorage)).toEqual(state);
  });

  it('makes only the first profile active; adding another keeps the active one', () => {
    const state = addProfile(addProfile(EMPTY, alex), sam);
    expect(state.profiles.map((p) => p.name)).toEqual(['Alex', 'Sam']);
    expect(activeProfile(state)).toEqual(alex);
  });

  it('imports a new profile as the active one, or switches to a known token', () => {
    const state = addProfile(EMPTY, alex);
    expect(activeProfile(importProfile(state, sam))).toEqual(sam);
    const again = importProfile(importProfile(state, sam), { ...alex, id: 'other' });
    expect(again.profiles).toHaveLength(2);
    expect(activeProfile(again)).toEqual(alex);
  });

  it('switches only to a known profile', () => {
    const state = addProfile(addProfile(EMPTY, alex), sam);
    expect(activeProfile(switchProfile(state, 'a'))).toEqual(alex);
    expect(switchProfile(state, 'nope')).toEqual(state);
  });

  it('renames with a trimmed, length-limited name, keeping the old one if blank', () => {
    const state = addProfile(EMPTY, alex);
    expect(activeProfile(renameProfile(state, 'a', '  Alexandra  '))?.name).toBe('Alexandra');
    expect(activeProfile(renameProfile(state, 'a', '   '))?.name).toBe('Alex');
    expect(normaliseName('x'.repeat(50), 'P')).toHaveLength(30);
    expect(normaliseName('', 'Player 2')).toBe('Player 2');
  });

  it('falls back to the first remaining profile when the active one is removed', () => {
    const state = switchProfile(addProfile(addProfile(EMPTY, alex), sam), 's');
    const removed = removeProfile(state, 's');
    expect(removed.profiles).toEqual([alex]);
    expect(activeProfile(removed)).toEqual(alex);
    expect(removeProfile(removed, 'a')).toEqual(EMPTY);
  });

  it('keeps the active profile when another one is removed', () => {
    const state = switchProfile(addProfile(addProfile(EMPTY, alex), sam), 's');
    expect(activeProfile(removeProfile(state, 'a'))).toEqual(sam);
  });
});
