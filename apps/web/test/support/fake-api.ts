import type { CompletedSession } from '@steady/core';
import { vi } from 'vitest';
import { ApiError, type Api } from '../../src/api/client.js';

export const tokenN = (n: number) => String(n).padStart(43, 'x');

/** An in-memory stand-in for the API: createPlayer hands out tokens 1, 2, 3, … */
export function fakeBackend() {
  let issued = 0;
  const calls: { token: string | null; method: string }[] = [];
  const unauthorized = new Set<string>();
  const sessions = new Map<string, CompletedSession[]>();
  const control = { failCreate: false };

  const factory = vi.fn((token: string | null): Api => {
    const call = (method: string) => {
      calls.push({ token, method });
      if (token && unauthorized.has(token)) throw new ApiError('unauthorized', 'Unauthorized', 401);
    };
    const unused = async (): Promise<never> => {
      throw new Error('not used in this test');
    };
    return {
      createPlayer: async () => {
        call('createPlayer');
        if (control.failCreate) throw new ApiError('network', 'Could not reach the server.');
        return { token: tokenN(++issued) };
      },
      startSession: unused,
      submitSession: unused,
      listSessions: async () => (call('listSessions'), sessions.get(token ?? '') ?? []),
      getProgress: unused,
      deleteMe: async () => {
        call('deleteMe');
        if (token) unauthorized.add(token);
      },
    };
  });

  return { factory, calls, unauthorized, sessions, control, created: () => issued };
}
