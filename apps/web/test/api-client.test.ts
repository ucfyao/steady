import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../src/api/client.js';

const TOKEN = 'T'.repeat(43);

function fakeFetch(status: number, body?: unknown) {
  return vi.fn<typeof fetch>(async () =>
    body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
  );
}

const callOf = (f: ReturnType<typeof fakeFetch>) => {
  const [url, init] = f.mock.calls[0]!;
  return { url: String(url), init: init!, headers: new Headers(init!.headers) };
};

describe('API client', () => {
  it('creates a player with its name, without a token (Spec 013)', async () => {
    const f = fakeFetch(201, { token: TOKEN });
    expect(await createApi(null, f).createPlayer({ name: 'Ana' })).toEqual({ token: TOKEN });
    const { url, init, headers } = callOf(f);
    expect(url).toBe('/api/players');
    expect(init.method).toBe('POST');
    expect(headers.has('authorization')).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Ana' });
  });

  it('reads and renames the player with the token (Spec 013)', async () => {
    const get = fakeFetch(200, { name: 'Ana', variant: 'calm' });
    expect(await createApi(TOKEN, get).getMe()).toEqual({ name: 'Ana', variant: 'calm' });
    expect(callOf(get).url).toBe('/api/me');
    expect(callOf(get).init.method).toBe('GET');

    const patch = fakeFetch(200, { name: 'Anna', variant: 'calm' });
    expect(await createApi(TOKEN, patch).updateMe({ name: 'Anna' })).toEqual({
      name: 'Anna',
      variant: 'calm',
    });
    const { url, init, headers } = callOf(patch);
    expect(url).toBe('/api/me');
    expect(init.method).toBe('PATCH');
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Anna' });
  });

  it('sends the bearer token and a JSON body when starting a session', async () => {
    const f = fakeFetch(201, { id: 'abc', startedAt: 'x', plan: { trials: [], probeAfter: [] } });
    await createApi(TOKEN, f).startSession({ checkIn: { sleep: 'ok' }, device: 'touch' });
    const { url, init, headers } = callOf(f);
    expect(url).toBe('/api/sessions');
    expect(init.method).toBe('POST');
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ checkIn: { sleep: 'ok' }, device: 'touch' });
  });

  it('submits to the session path and lists, reads progress and deletes with the token', async () => {
    const submit = fakeFetch(200, { id: 'abc' });
    await createApi(TOKEN, submit).submitSession('abc', { rts: [null], probeAnswers: [] });
    expect(callOf(submit).url).toBe('/api/sessions/abc/submit');

    for (const [call, path, method] of [
      [(a: ReturnType<typeof createApi>) => a.listSessions(), '/api/sessions', 'GET'],
      [(a: ReturnType<typeof createApi>) => a.getProgress(), '/api/progress', 'GET'],
    ] as const) {
      const f = fakeFetch(200, {});
      await call(createApi(TOKEN, f));
      expect(callOf(f).url).toBe(path);
      expect(callOf(f).init.method).toBe(method);
      expect(callOf(f).headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    }
  });

  it('returns nothing for 204 No Content', async () => {
    const f = fakeFetch(204);
    await expect(createApi(TOKEN, f).deleteMe()).resolves.toBeUndefined();
    expect(callOf(f).init.method).toBe('DELETE');
    expect(callOf(f).url).toBe('/api/me');
  });

  it.each([
    [401, 'unauthorized', { message: 'Unauthorized' }],
    [404, 'not_found', { message: 'Not Found' }],
    [409, 'conflict', { message: 'Session already submitted with different responses' }],
    [429, 'rate_limited', { message: 'ThrottlerException: Too Many Requests' }],
    [500, 'server', { message: 'Internal server error' }],
  ] as const)('maps %i to a %s error', async (status, kind, body) => {
    const err = await createApi(TOKEN, fakeFetch(status, body))
      .listSessions()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ kind, status });
  });

  it("keeps the server's validation errors on 400", async () => {
    const err = await createApi(
      TOKEN,
      fakeFetch(400, { message: 'Invalid request', errors: ['device: bad'] }),
    )
      .startSession({ device: 'keyboard' })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'invalid', status: 400, errors: ['device: bad'] });
  });

  it("keeps the server's message on 422", async () => {
    const err = await createApi(
      TOKEN,
      fakeFetch(422, { message: 'Session expired; start a new one' }),
    )
      .submitSession('abc', { rts: [], probeAnswers: [] })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({
      kind: 'unprocessable',
      message: 'Session expired; start a new one',
    });
  });

  it('reports a network failure', async () => {
    const f = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await createApi(TOKEN, f)
      .listSessions()
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'network', status: null });
  });
});
