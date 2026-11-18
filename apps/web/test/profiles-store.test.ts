import { describe, expect, it } from 'vitest';
import {
  ACTIVE_KEY,
  GROUP_KEY,
  loadActiveId,
  loadGroup,
  normaliseName,
  saveActiveId,
  saveGroup,
} from '../src/players/store.js';

// Spec 016: the players are on the server; this browser keeps only the selected id.
describe('selected player', () => {
  it('saves, loads and clears the selected id', () => {
    expect(loadActiveId(localStorage)).toBeNull();
    saveActiveId(localStorage, 'p1');
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('p1');
    expect(loadActiveId(localStorage)).toBe('p1');
    saveActiveId(localStorage, null);
    expect(loadActiveId(localStorage)).toBeNull();
  });

  it('copes with storage that throws (blocked site data)', () => {
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
    expect(loadActiveId(blocked)).toBeNull();
    expect(() => saveActiveId(blocked, 'p1')).not.toThrow();
  });
});

// Spec 028: the selected player's group, for the scene while the list loads.
describe('remembered group', () => {
  it('saves, loads and clears the group', () => {
    expect(loadGroup(localStorage)).toBeNull();
    saveGroup(localStorage, 'game');
    expect(localStorage.getItem(GROUP_KEY)).toBe('game');
    expect(loadGroup(localStorage)).toBe('game');
    saveGroup(localStorage, null);
    expect(loadGroup(localStorage)).toBeNull();
  });

  it('ignores a value that is not a group', () => {
    localStorage.setItem(GROUP_KEY, 'purple');
    expect(loadGroup(localStorage)).toBeNull();
  });

  it('copes with storage that throws', () => {
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
    expect(loadGroup(blocked)).toBeNull();
    expect(() => saveGroup(blocked, 'calm')).not.toThrow();
  });
});

describe('normaliseName', () => {
  it('trims and caps at 30 characters', () => {
    expect(normaliseName('  Sam  ', 'Player 2')).toBe('Sam');
    expect(normaliseName('x'.repeat(40), 'Player 2')).toHaveLength(30);
  });

  it('falls back for a blank name', () => {
    expect(normaliseName('   ', 'Player 2')).toBe('Player 2');
    expect(normaliseName('', 'Player 3')).toBe('Player 3');
  });
});
