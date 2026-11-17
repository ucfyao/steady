/**
 * Local player profiles (Spec 004): the tokens of this device's players. A name here is only a
 * cache of the server's (Spec 013), so the menu can show it before the server answers.
 */
export interface Profile {
  id: string;
  name: string;
  token: string;
}

export interface ProfilesState {
  profiles: Profile[];
  activeId: string | null;
}

export const STORAGE_KEY = 'steady.players.v1';
export const EMPTY: ProfilesState = { profiles: [], activeId: null };
const MAX_NAME = 30;

const isProfile = (p: unknown): p is Profile =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Profile).id === 'string' &&
  typeof (p as Profile).name === 'string' &&
  typeof (p as Profile).token === 'string';

/** Anything unreadable is treated as "no profiles yet" rather than crashing the app. */
export function loadProfiles(storage: Storage): ProfilesState {
  try {
    const raw: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return EMPTY;
    const { profiles, activeId } = raw as Partial<ProfilesState>;
    if (!Array.isArray(profiles) || !profiles.every(isProfile)) return EMPTY;
    const active = profiles.some((p) => p.id === activeId) ? activeId! : (profiles[0]?.id ?? null);
    return { profiles, activeId: active };
  } catch {
    return EMPTY;
  }
}

export function saveProfiles(storage: Storage, state: ProfilesState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normaliseName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed || fallback;
}

/** Adds a profile without switching to it; only the first one on a device becomes active. */
export const addProfile = (s: ProfilesState, p: Profile): ProfilesState => ({
  profiles: [...s.profiles, p],
  activeId: s.activeId ?? p.id,
});

export const switchProfile = (s: ProfilesState, id: string): ProfilesState =>
  s.profiles.some((p) => p.id === id) ? { ...s, activeId: id } : s;

export const renameProfile = (s: ProfilesState, id: string, name: string): ProfilesState => ({
  ...s,
  profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: normaliseName(name, p.name) } : p)),
});

export function removeProfile(s: ProfilesState, id: string): ProfilesState {
  const profiles = s.profiles.filter((p) => p.id !== id);
  const activeId = s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId;
  return { profiles, activeId };
}

export const activeProfile = (s: ProfilesState): Profile | null =>
  s.profiles.find((p) => p.id === s.activeId) ?? null;

/** Adds an imported player, or switches to it if this device already has its token. */
export function importProfile(s: ProfilesState, p: Profile): ProfilesState {
  const existing = s.profiles.find((q) => q.token === p.token);
  return existing ? { ...s, activeId: existing.id } : { ...addProfile(s, p), activeId: p.id };
}
