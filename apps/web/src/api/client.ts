import type {
  CheckIn,
  CompletedSession,
  InputDevice,
  ProgressResponse,
  StartedSession,
  Submission,
} from '@steady/core';

export type ApiErrorKind =
  | 'invalid'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'unprocessable'
  | 'rate_limited'
  | 'server'
  | 'network';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly errors: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Api {
  createPlayer(): Promise<{ token: string }>;
  startSession(body: { checkIn?: CheckIn | null; device: InputDevice }): Promise<StartedSession>;
  submitSession(id: string, submission: Submission): Promise<CompletedSession>;
  listSessions(): Promise<CompletedSession[]>;
  getProgress(): Promise<ProgressResponse>;
  deleteMe(): Promise<void>;
}

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  400: 'invalid',
  401: 'unauthorized',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable',
  429: 'rate_limited',
};

/** A thin typed wrapper over the API (Spec 003). The token, when given, goes in every request. */
export function createApi(token: string | null, fetchFn: typeof fetch = fetch): Api {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('content-type', 'application/json');

    let res: Response;
    try {
      res = await fetchFn(`/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network', 'Could not reach the server. Check your connection.');
    }

    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (res.ok) return data as T;

    const { message, errors } = (data ?? {}) as { message?: unknown; errors?: unknown };
    throw new ApiError(
      KIND_BY_STATUS[res.status] ?? 'server',
      typeof message === 'string' ? message : `Request failed (${res.status})`,
      res.status,
      Array.isArray(errors) ? errors.map(String) : [],
    );
  }

  return {
    createPlayer: () => request('POST', '/players'),
    startSession: (body) => request('POST', '/sessions', body),
    submitSession: (id, submission) =>
      request('POST', `/sessions/${encodeURIComponent(id)}/submit`, submission),
    listSessions: () => request('GET', '/sessions'),
    getProgress: () => request('GET', '/progress'),
    deleteMe: () => request('DELETE', '/me'),
  };
}
