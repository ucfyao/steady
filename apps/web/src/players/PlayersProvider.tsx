import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Variant } from '@steady/core';
import { ApiError, createApi, type Api } from '../api/client.js';
import {
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
  type ProfilesState,
} from './store.js';

export interface PlayersContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  profiles: Profile[];
  active: Profile | null;
  /** API client for the active player; a 401 removes that player from this device. */
  api: Api | null;
  notice: string | null;
  dismissNotice(): void;
  /**
   * Creates a player on the server with its name ("Player N" when none is given; Spec 013).
   * `variant`: development only (Spec 011 §3); without it the server draws the group.
   */
  addPlayer(name?: string, variant?: Variant): Promise<void>;
  switchTo(id: string): void;
  /** Renames a player on the server with its own token, then here. Throws if the API fails. */
  rename(id: string, name: string): Promise<void>;
  /**
   * Reads the player's name from the server (which also checks the token), then adds that
   * player here (or switches to it if this device already has it) and makes it active.
   * Throws the API's error if the check fails.
   */
  importPlayer(token: string): Promise<void>;
  /**
   * Deletes a player's data on the server with that player's own token, then removes the
   * profile here. Any player on this device can be deleted; deleting the active one makes
   * another active (or, with none left, a new player is created).
   */
  deletePlayer(id: string): Promise<void>;
  retry(): void;
  /** Each player's group, by profile id, read with their names (for Spec 011's tags). */
  groups: Partial<Record<string, Variant>>;
}

export const PlayersContext = createContext<PlayersContextValue | null>(null);

/** What the notice reports. Removed players are counted, so several make one message. */
type NoticeState = { kind: 'gone'; ids: string[] } | { kind: 'deleted'; name: string };

function noticeText(n: NoticeState): string {
  if (n.kind === 'deleted')
    return `${n.name}'s data was deleted from the server and from this device.`;
  return n.ids.length === 1
    ? 'That player no longer exists on the server, so it was removed from this device.'
    : `${n.ids.length} players no longer exist on the server and were removed from this device.`;
}

export function PlayersProvider({
  children,
  apiFactory = createApi,
  storage = localStorage,
}: {
  children: ReactNode;
  apiFactory?: (token: string | null) => Api;
  storage?: Storage;
}) {
  const [state, setState] = useState<ProfilesState>(() => loadProfiles(storage));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Guards against creating two players when StrictMode runs the effect twice.
  const creating = useRef<Promise<void> | null>(null);

  useEffect(() => saveProfiles(storage, state), [storage, state]);

  const count = state.profiles.length;
  const createProfile = useCallback(
    async (name?: string, variant?: Variant) => {
      // Spec 013: the name is stored with the player; the server keeps the trimmed one.
      const chosen = normaliseName(name ?? '', `Player ${count + 1}`);
      const { token } = await apiFactory(null).createPlayer(
        variant ? { name: chosen, variant } : { name: chosen },
      );
      setState((s) => addProfile(s, { id: crypto.randomUUID(), token, name: chosen }));
    },
    [apiFactory, count],
  );

  // Spec 013: the server's names win over the cached ones; the groups come with them.
  const [groups, setGroups] = useState<Partial<Record<string, Variant>>>({});
  const tokens = state.profiles.map((p) => `${p.id}:${p.token}`).join(' ');
  useEffect(() => {
    let cancelled = false;
    for (const pair of tokens ? tokens.split(' ') : []) {
      const [id, token] = pair.split(':') as [string, string];
      apiFactory(token)
        .getMe()
        .then((me) => {
          if (cancelled) return;
          // Only a real change touches the state, so screens do not reload for nothing.
          setState((s) => {
            const p = s.profiles.find((x) => x.id === id);
            return p && p.name !== me.name ? renameProfile(s, id, me.name) : s;
          });
          setGroups((g) => ({ ...g, [id]: me.variant }));
        })
        // A player the server no longer knows is removed when it is next used (`api`).
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [tokens, apiFactory]);

  // A device with no players (first visit, or after deleting the last one) gets a new one.
  useEffect(() => {
    if (state.profiles.length > 0 || error || creating.current) return;
    creating.current = createProfile()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        creating.current = null;
      });
  }, [state.profiles.length, error, createProfile]);

  const active = activeProfile(state);

  // Keyed by the player's id and token, not the profile: a rename (Spec 013) must not give
  // screens a new client, which would make them load everything again.
  const activeId = active?.id;
  const activeToken = active?.token;
  const api = useMemo<Api | null>(() => {
    if (!activeId || !activeToken) return null;
    const inner = apiFactory(activeToken);
    const forget = (e: unknown) => {
      if (e instanceof ApiError && e.kind === 'unauthorized') {
        setState((s) => removeProfile(s, activeId));
        // Two calls failing for the same player count it once.
        setNotice((n) =>
          n?.kind !== 'gone'
            ? { kind: 'gone', ids: [activeId] }
            : n.ids.includes(activeId)
              ? n
              : { kind: 'gone', ids: [...n.ids, activeId] },
        );
      }
      throw e;
    };
    return {
      createPlayer: (body) => inner.createPlayer(body),
      startSession: (body) => inner.startSession(body).catch(forget),
      submitSession: (id, submission) => inner.submitSession(id, submission).catch(forget),
      getMe: () => inner.getMe().catch(forget),
      updateMe: (body) => inner.updateMe(body).catch(forget),
      listSessions: () => inner.listSessions().catch(forget),
      getProgress: () => inner.getProgress().catch(forget),
      deleteMe: () => inner.deleteMe().catch(forget),
    };
  }, [activeId, activeToken, apiFactory]);

  const importPlayer = useCallback(
    async (token: string) => {
      // A raw client: a 401 here means a bad link, not that the active player is gone.
      const me = await apiFactory(token).getMe();
      setState((s) => importProfile(s, { id: crypto.randomUUID(), token, name: me.name }));
    },
    [apiFactory],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const target = state.profiles.find((p) => p.id === id);
      if (!target) return;
      // With that player's own token; the server's (trimmed) name is the one kept.
      const me = await apiFactory(target.token).updateMe({ name });
      setState((s) => renameProfile(s, id, me.name));
    },
    [state.profiles, apiFactory],
  );

  const deletePlayer = useCallback(
    async (id: string) => {
      const target = state.profiles.find((p) => p.id === id);
      if (!target) return;
      try {
        await apiFactory(target.token).deleteMe();
      } catch (e) {
        // Already gone on the server: removing it here is still right.
        if (!(e instanceof ApiError && e.kind === 'unauthorized')) throw e;
      }
      setState((s) => removeProfile(s, id));
      setNotice({ kind: 'deleted', name: target.name });
    },
    [state.profiles, apiFactory],
  );

  const value: PlayersContextValue = {
    status: error ? 'error' : active ? 'ready' : 'loading',
    error,
    profiles: state.profiles,
    active,
    api,
    notice: notice && noticeText(notice),
    dismissNotice: () => setNotice(null),
    addPlayer: createProfile,
    switchTo: (id) => setState((s) => switchProfile(s, id)),
    rename,
    importPlayer,
    deletePlayer,
    retry: () => setError(null),
    groups,
  };

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
}
