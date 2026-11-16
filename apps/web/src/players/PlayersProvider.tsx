import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, createApi, type Api } from '../api/client.js';
import {
  activeProfile,
  addProfile,
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
  addPlayer(name?: string): Promise<void>;
  switchTo(id: string): void;
  rename(id: string, name: string): void;
  /** Deletes the active player's data on the server, then removes the profile here. */
  deleteActive(): Promise<void>;
  retry(): void;
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

  const createProfile = useCallback(
    async (name?: string) => {
      const { token } = await apiFactory(null).createPlayer();
      const id = crypto.randomUUID();
      setState((s) =>
        addProfile(s, {
          id,
          token,
          name: normaliseName(name ?? '', `Player ${s.profiles.length + 1}`),
        }),
      );
    },
    [apiFactory],
  );

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

  const api = useMemo<Api | null>(() => {
    if (!active) return null;
    const inner = apiFactory(active.token);
    const forget = (e: unknown) => {
      if (e instanceof ApiError && e.kind === 'unauthorized') {
        setState((s) => removeProfile(s, active.id));
        // Two calls failing for the same player count it once.
        setNotice((n) =>
          n?.kind !== 'gone'
            ? { kind: 'gone', ids: [active.id] }
            : n.ids.includes(active.id)
              ? n
              : { kind: 'gone', ids: [...n.ids, active.id] },
        );
      }
      throw e;
    };
    return {
      createPlayer: () => inner.createPlayer(),
      startSession: (body) => inner.startSession(body).catch(forget),
      submitSession: (id, submission) => inner.submitSession(id, submission).catch(forget),
      listSessions: () => inner.listSessions().catch(forget),
      getProgress: () => inner.getProgress().catch(forget),
      deleteMe: () => inner.deleteMe().catch(forget),
    };
  }, [active, apiFactory]);

  const deleteActive = useCallback(async () => {
    if (!active) return;
    try {
      await apiFactory(active.token).deleteMe();
    } catch (e) {
      // Already gone on the server: removing it here is still right.
      if (!(e instanceof ApiError && e.kind === 'unauthorized')) throw e;
    }
    setState((s) => removeProfile(s, active.id));
    setNotice({ kind: 'deleted', name: active.name });
  }, [active, apiFactory]);

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
    rename: (id, name) => setState((s) => renameProfile(s, id, name)),
    deleteActive,
    retry: () => setError(null),
  };

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
}
