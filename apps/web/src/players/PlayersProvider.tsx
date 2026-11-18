import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlayerListItem, Variant } from '@steady/core';
import { ApiError, createApi, type Api } from '../api/client.js';
import {
  loadActiveId,
  loadGroup,
  normaliseName,
  saveActiveId,
  saveGroup,
  type Profile,
} from './store.js';

export interface PlayersContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** Every player on the server (Spec 016), oldest first. */
  profiles: Profile[];
  /** The selected player. */
  active: Profile | null;
  /** API client for the selected player; a 401 reads the list again. */
  api: Api | null;
  notice: string | null;
  dismissNotice(): void;
  /**
   * Creates a player on the server with its name ("Player N" when none is given; Spec 013),
   * then reads the list again. `variant`: development only (Spec 011 §3).
   */
  addPlayer(name?: string, variant?: Variant): Promise<void>;
  switchTo(id: string): void;
  /** Renames a player on the server with its own token. Throws if the API fails. */
  rename(id: string, name: string): Promise<void>;
  /**
   * Deletes a player and their sessions on the server with that player's own token. Deleting
   * the selected one selects the first one left (or, with none left, a new player is created).
   */
  deletePlayer(id: string): Promise<void>;
  retry(): void;
  /** Each player's group, by player id (for Spec 011's tags). */
  groups: Partial<Record<string, Variant>>;
  /**
   * The selected player's group (Spec 028): from the list once it has arrived; until then the
   * group remembered in this browser, so the scene can be drawn while the app sets up.
   */
  activeGroup: Variant | null;
}

export const PlayersContext = createContext<PlayersContextValue | null>(null);

type NoticeState = { kind: 'gone' } | { kind: 'deleted'; name: string };

function noticeText(n: NoticeState): string {
  return n.kind === 'deleted'
    ? `${n.name} and their sessions were deleted.`
    : 'That player no longer exists.';
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function PlayersProvider({
  children,
  apiFactory = createApi,
  storage = localStorage,
}: {
  children: ReactNode;
  apiFactory?: (token: string | null) => Api;
  storage?: Storage;
}) {
  // Spec 016: the list comes from the server; this browser keeps only the selection.
  const [list, setList] = useState<PlayerListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => loadActiveId(storage));
  const [rememberedGroup] = useState<Variant | null>(() => loadGroup(storage));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Guards against creating two players when StrictMode runs the effect twice.
  const creating = useRef<Promise<void> | null>(null);

  const reload = useCallback(async () => {
    const players = await apiFactory(null).listPlayers();
    setList(players);
  }, [apiFactory]);

  // Read the list on load, and again after Try again.
  useEffect(() => {
    if (error) return;
    let cancelled = false;
    apiFactory(null)
      .listPlayers()
      .then((players) => !cancelled && setList(players))
      .catch((e: unknown) => !cancelled && setError(message(e)));
    return () => {
      cancelled = true;
    };
  }, [apiFactory, error]);

  const profiles = useMemo<Profile[]>(
    () => (list ?? []).map(({ id, name, token }) => ({ id, name, token })),
    [list],
  );
  const groups = useMemo(
    () => Object.fromEntries((list ?? []).map((p) => [p.id, p.variant])),
    [list],
  );

  // The selected player, or the first one when none (or a missing one) is selected.
  const active = profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null;
  const activeId = active?.id ?? null;
  const activeGroup = list ? ((activeId ? groups[activeId] : undefined) ?? null) : rememberedGroup;
  useEffect(() => {
    if (!list) return;
    saveActiveId(storage, activeId);
    saveGroup(storage, activeGroup);
  }, [storage, list, activeId, activeGroup]);

  const count = profiles.length;
  const createProfile = useCallback(
    async (name?: string, variant?: Variant) => {
      const chosen = normaliseName(name ?? '', `Player ${count + 1}`);
      await apiFactory(null).createPlayer(variant ? { name: chosen, variant } : { name: chosen });
      await reload();
    },
    [apiFactory, count, reload],
  );

  // No players at all (a new server, or after deleting the last one): create one.
  useEffect(() => {
    if (!list || list.length > 0 || error || creating.current) return;
    creating.current = createProfile()
      .catch((e: unknown) => setError(message(e)))
      .finally(() => {
        creating.current = null;
      });
  }, [list, error, createProfile]);

  // Keyed by the player's id and token, not the profile: a rename must not give screens a new
  // client, which would make them load everything again.
  const activeToken = active?.token;
  const api = useMemo<Api | null>(() => {
    if (!activeId || !activeToken) return null;
    const inner = apiFactory(activeToken);
    // Deleted elsewhere: read the list again (the first player is then selected).
    const gone = (e: unknown) => {
      if (e instanceof ApiError && e.kind === 'unauthorized') {
        setNotice({ kind: 'gone' });
        reload().catch((err: unknown) => setError(message(err)));
      }
      throw e;
    };
    return {
      createPlayer: (body) => inner.createPlayer(body),
      listPlayers: () => inner.listPlayers(),
      startSession: (body) => inner.startSession(body).catch(gone),
      submitSession: (id, submission) => inner.submitSession(id, submission).catch(gone),
      getMe: () => inner.getMe().catch(gone),
      updateMe: (body) => inner.updateMe(body).catch(gone),
      listSessions: () => inner.listSessions().catch(gone),
      getProgress: () => inner.getProgress().catch(gone),
      deleteMe: () => inner.deleteMe().catch(gone),
    };
  }, [activeId, activeToken, apiFactory, reload]);

  const tokenOf = useCallback((id: string) => profiles.find((p) => p.id === id), [profiles]);

  const rename = useCallback(
    async (id: string, name: string) => {
      const target = tokenOf(id);
      if (!target) return;
      await apiFactory(target.token).updateMe({ name });
      await reload();
    },
    [tokenOf, apiFactory, reload],
  );

  const deletePlayer = useCallback(
    async (id: string) => {
      const target = tokenOf(id);
      if (!target) return;
      try {
        await apiFactory(target.token).deleteMe();
      } catch (e) {
        // Already gone on the server: reading the list again is still right.
        if (!(e instanceof ApiError && e.kind === 'unauthorized')) throw e;
      }
      await reload();
      setNotice({ kind: 'deleted', name: target.name });
    },
    [tokenOf, apiFactory, reload],
  );

  const value: PlayersContextValue = {
    status: error ? 'error' : active ? 'ready' : 'loading',
    error,
    profiles,
    active,
    api,
    notice: notice && noticeText(notice),
    dismissNotice: () => setNotice(null),
    addPlayer: createProfile,
    switchTo: (id) => {
      if (profiles.some((p) => p.id === id)) setSelectedId(id);
    },
    rename,
    deletePlayer,
    retry: () => setError(null),
    groups,
    activeGroup,
  };

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
}
