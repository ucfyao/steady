import {
  compareByCheckIn,
  comparePreProbe,
  createSessionPlan,
  scoreSession,
  summariseProgress,
  type ProgressMetric,
  type ProgressResponse,
  type CompletedSession,
  type StartedSession,
  type Submission,
  type Variant,
} from '@steady/core';
import { vi } from 'vitest';
import { ApiError, type Api } from '../../src/api/client.js';

const METRICS: ProgressMetric[] = ['commissionRate', 'omissionRate', 'medianGoRtMs', 'rtCv'];

/** What GET /api/progress returns for these sessions: core's functions, as the API calls them. */
export function progressOf(sessions: CompletedSession[]): ProgressResponse {
  const history = sessions.map((s) => ({ score: s.score, checkIn: s.checkIn }));
  const byMetric = (dimension: 'sleep' | 'stress') =>
    Object.fromEntries(
      METRICS.map((m) => [m, compareByCheckIn(history, dimension, m)]),
    ) as ProgressResponse['checkIn']['sleep'];
  return {
    summary: summariseProgress(history),
    checkIn: { sleep: byMetric('sleep'), stress: byMetric('stress') },
    preProbe: comparePreProbe(history),
  };
}

export const tokenN = (n: number) => String(n).padStart(43, 'x');

/**
 * An in-memory stand-in for the API: createPlayer hands out tokens 1, 2, 3, … and ids p1, p2, …;
 * `addPlayer` puts a player on the server for a test (tokens 101, 102, …).
 */
export function fakeBackend() {
  let issued = 0;
  let added = 100;
  const calls: { token: string | null; method: string }[] = [];
  const unauthorized = new Set<string>();
  const sessions = new Map<string, CompletedSession[]>();
  /** `variant`: what GET /api/me and a new session report (the player's A/B group). */
  const control = {
    failCreate: false,
    failSubmitOnce: false,
    failListOnce: false,
    failUpdateOnce: false,
    /** GET /api/players fails once (Spec 016). */
    failPlayersOnce: false,
    /** What the failed list throws: a network error, or the server's own (raw) message. */
    failListKind: 'network' as 'network' | 'server',
    variant: 'calm' as Variant,
  };
  const started: { token: string | null; body: Parameters<Api['startSession']>[0] }[] = [];
  const submitted: { id: string; body: Submission }[] = [];
  const plans = new Map<string, StartedSession>();
  /** A player's own group by token (GET /api/me); `control.variant` otherwise. */
  const variants = new Map<string, Variant>();
  /** Tokens whose GET /api/me fails. */
  const meFails = new Set<string>();
  /** Each player's name on the server, by token (Spec 013). */
  const names = new Map<string, string>();
  /** Each PATCH /api/me, in order. */
  const updated: { token: string | null; name: string }[] = [];
  /** The players on the server, oldest first (Spec 016). */
  const registry: { id: string; token: string }[] = [];
  /** The body of each POST /api/players, in order. */
  const createdWith: Parameters<Api['createPlayer']>[0][] = [];

  /** GET /api/me: the stored name ("Player" when the test never set one) and the group. */
  const me = (token: string | null) => ({
    name: (token && names.get(token)) || 'Player',
    variant: (token && variants.get(token)) || control.variant,
  });

  const factory = vi.fn((token: string | null): Api => {
    const call = (method: string) => {
      calls.push({ token, method });
      if (token && unauthorized.has(token)) throw new ApiError('unauthorized', 'Unauthorized', 401);
    };
    return {
      createPlayer: async (body) => {
        call('createPlayer');
        if (control.failCreate) throw new ApiError('network', 'Could not reach the server.');
        createdWith.push(body);
        const t = tokenN(++issued);
        names.set(t, body.name.trim());
        if (body.variant) variants.set(t, body.variant);
        registry.push({ id: `p${issued}`, token: t });
        return { token: t };
      },
      startSession: async (body) => {
        call('startSession');
        const id = `session-${plans.size + 1}`;
        const { trials, probeAfter } = createSessionPlan(1000 + plans.size);
        const session: StartedSession = {
          id,
          startedAt: new Date(0).toISOString(),
          variant: body.variant ?? control.variant,
          plan: { trials, probeAfter },
        };
        plans.set(id, session);
        started.push({ token, body });
        return session;
      },
      submitSession: async (id, body) => {
        call('submitSession');
        if (control.failSubmitOnce) {
          control.failSubmitOnce = false;
          throw new ApiError('network', 'Could not reach the server.');
        }
        submitted.push({ id, body });
        const plan = plans.get(id)!.plan;
        // A fake server: test code may score, the web app never does.
        return {
          id,
          startedAt: new Date(0).toISOString(),
          completedAt: new Date(150_000).toISOString(),
          checkIn: null,
          device: started.at(-1)!.body.device,
          variant: plans.get(id)!.variant,
          score: scoreSession({ seed: 0, ...plan }, body),
        };
      },
      getMe: async () => {
        call('getMe');
        if (token && meFails.has(token))
          throw new ApiError('network', 'Could not reach the server.');
        return me(token);
      },
      updateMe: async (body) => {
        call('updateMe');
        if (control.failUpdateOnce) {
          control.failUpdateOnce = false;
          throw new ApiError('network', 'Could not reach the server.');
        }
        if (token) names.set(token, body.name.trim());
        updated.push({ token, name: body.name });
        return me(token);
      },
      listSessions: async () => {
        call('listSessions');
        if (control.failListOnce) {
          control.failListOnce = false;
          throw control.failListKind === 'network'
            ? new ApiError('network', 'Could not reach the server.')
            : new ApiError('server', 'Request failed (500)', 500);
        }
        return sessions.get(token ?? '') ?? [];
      },
      getProgress: async () => {
        call('getProgress');
        return progressOf(sessions.get(token ?? '') ?? []);
      },
      deleteMe: async () => {
        call('deleteMe');
        if (!token) return;
        unauthorized.add(token);
        const i = registry.findIndex((r) => r.token === token);
        if (i >= 0) registry.splice(i, 1);
      },
      listPlayers: async () => {
        call('listPlayers');
        if (control.failPlayersOnce) {
          control.failPlayersOnce = false;
          throw new ApiError('network', 'Could not reach the server.');
        }
        return registry.map((r, i) => ({
          id: r.id,
          token: r.token,
          ...me(r.token),
          completedSessions: (sessions.get(r.token) ?? []).length,
          createdAt: new Date(i * 1000).toISOString(),
        }));
      },
    };
  });

  return {
    factory,
    calls,
    unauthorized,
    sessions,
    control,
    started,
    submitted,
    plans,
    variants,
    meFails,
    createdWith,
    names,
    updated,
    created: () => issued,
    registry,
    /** Deletes a player on the server as another browser would: gone from the list, token dead. */
    deleteElsewhere(token: string) {
      unauthorized.add(token);
      const i = registry.findIndex((r) => r.token === token);
      if (i >= 0) registry.splice(i, 1);
    },
    /** Puts a player on the server, as another browser (or the seed) would have. */
    addPlayer(name: string, opts: { variant?: Variant; token?: string; id?: string } = {}) {
      const token = opts.token ?? tokenN(++added);
      const id = opts.id ?? `seed-${registry.length + 1}-${name.toLowerCase()}`;
      registry.push({ id, token });
      names.set(token, name);
      if (opts.variant) variants.set(token, opts.variant);
      return { id, token };
    },
  };
}
