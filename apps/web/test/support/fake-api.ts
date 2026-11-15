import {
  compareByCheckIn,
  comparePreProbe,
  createSessionPlan,
  scoreSession,
  summariseProgress,
  type ProgressMetric,
  type ProgressResponse,
  type CompletedSession,
  type InputDevice,
  type StartedSession,
  type Submission,
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

/** An in-memory stand-in for the API: createPlayer hands out tokens 1, 2, 3, … */
export function fakeBackend() {
  let issued = 0;
  const calls: { token: string | null; method: string }[] = [];
  const unauthorized = new Set<string>();
  const sessions = new Map<string, CompletedSession[]>();
  const control = { failCreate: false, failSubmitOnce: false };
  const started: { token: string | null; body: { device: InputDevice } }[] = [];
  const submitted: { id: string; body: Submission }[] = [];
  const plans = new Map<string, StartedSession>();

  const factory = vi.fn((token: string | null): Api => {
    const call = (method: string) => {
      calls.push({ token, method });
      if (token && unauthorized.has(token)) throw new ApiError('unauthorized', 'Unauthorized', 401);
    };
    return {
      createPlayer: async () => {
        call('createPlayer');
        if (control.failCreate) throw new ApiError('network', 'Could not reach the server.');
        return { token: tokenN(++issued) };
      },
      startSession: async (body) => {
        call('startSession');
        const id = `session-${plans.size + 1}`;
        const { trials, probeAfter } = createSessionPlan(1000 + plans.size);
        const session = { id, startedAt: new Date(0).toISOString(), plan: { trials, probeAfter } };
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
          score: scoreSession({ seed: 0, ...plan }, body),
        };
      },
      listSessions: async () => (call('listSessions'), sessions.get(token ?? '') ?? []),
      getProgress: async () => {
        call('getProgress');
        return progressOf(sessions.get(token ?? '') ?? []);
      },
      deleteMe: async () => {
        call('deleteMe');
        if (token) unauthorized.add(token);
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
    created: () => issued,
  };
}
