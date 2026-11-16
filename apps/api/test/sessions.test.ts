import {
  SUBMIT_CONFIG,
  scoreSession,
  type CompletedSession,
  type StartedSession,
} from '@steady/core';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessions } from '../src/db/schema.js';
import { startTestApp, type TestApp } from './support/app.js';
import {
  PLAUSIBLE_MS,
  auth,
  newPlayer,
  perfectSubmission,
  pressEverything,
  startSession,
} from './support/players.js';

let t: TestApp;
let token: string;
beforeAll(async () => {
  t = await startTestApp();
  token = await newPlayer(t);
});
afterAll(() => t?.close());

const submit = (id: string, body: unknown, as = token) =>
  request(t.http)
    .post(`/api/sessions/${id}/submit`)
    .set(auth(as))
    .send(body as object);
const row = async (id: string) =>
  (await t.db.select().from(sessions).where(eq(sessions.id, id)))[0]!;
// The API must score with core's scoreSession on the plan it handed out. Core's own
// tests check the scoring itself; here we only check the API wires it up correctly.
const expectedScore = (s: StartedSession, body: Parameters<typeof scoreSession>[1]) =>
  scoreSession({ seed: 0, ...s.plan }, body);

describe('session routes need a token', () => {
  it.each([
    ['post', '/api/sessions'],
    ['post', '/api/sessions/00000000-0000-4000-8000-000000000000/submit'],
    ['get', '/api/sessions'],
  ] as const)('%s %s without a token → 401', async (method, path) => {
    await request(t.http)[method](path).expect(401);
  });
});

describe('POST /api/sessions', () => {
  it('returns an 81-trial plan with 3 probes, and not the seed', async () => {
    const s = await startSession(t, token);
    expect(s.plan.trials).toHaveLength(81);
    expect(s.plan.probeAfter).toHaveLength(3);
    expect(s).not.toHaveProperty('seed');
    expect(s.plan).not.toHaveProperty('seed');
    expect(s.startedAt).toBe(t.clock.now().toISOString());
    expect((await row(s.id)).completedAt).toBeNull();
  });

  it('stores the check-in, or null without one', async () => {
    const withCheckIn = await startSession(t, token, { sleep: 'poor', stress: 'high' });
    expect((await row(withCheckIn.id)).checkIn).toEqual({ sleep: 'poor', stress: 'high' });
    const res = await request(t.http)
      .post('/api/sessions')
      .set(auth(token))
      .send({ device: 'keyboard' })
      .expect(201);
    expect((await row(res.body.id)).checkIn).toBeNull();
  });

  it('stores the input device and returns it with the completed session', async () => {
    const p = await newPlayer(t);
    const s = await startSession(t, p, undefined, 'touch');
    expect((await row(s.id)).device).toBe('touch');
    t.clock.advance(PLAUSIBLE_MS);
    const res = await submit(s.id, perfectSubmission(s.plan), p).expect(200);
    expect(res.body.device).toBe('touch');
    const list = await request(t.http).get('/api/sessions').set(auth(p)).expect(200);
    expect(list.body[0].device).toBe('touch');
  });

  it.each([
    ['missing', {}],
    ['unknown', { device: 'mouse' }],
  ])('rejects a %s device with 400', async (_label, body) => {
    const res = await request(t.http).post('/api/sessions').set(auth(token)).send(body).expect(400);
    expect(res.body.errors).toEqual([expect.stringContaining('device')]);
  });

  it('rejects an unknown check-in level with 400', async () => {
    const res = await request(t.http)
      .post('/api/sessions')
      .set(auth(token))
      .send({ checkIn: { sleep: 'great' }, device: 'keyboard' })
      .expect(400);
    expect(res.body.errors).toEqual([expect.stringContaining('checkIn.sleep')]);
  });
});

describe('POST /api/sessions/:id/submit', () => {
  it('scores a session on the server and lists it', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = perfectSubmission(s.plan);
    const res = await submit(s.id, body).expect(200);

    const done = res.body as CompletedSession;
    expect(done.score).toEqual(expectedScore(s, body));
    expect(done.score.commissions).toBe(0);
    expect(done.completedAt).toBe(t.clock.now().toISOString());

    const list = await request(t.http).get('/api/sessions').set(auth(token)).expect(200);
    expect(list.body).toContainEqual(done);
  });

  it('ignores a score sent by the client', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = pressEverything(s.plan);
    const res = await submit(s.id, { ...body, score: { commissions: 0, dPrime: 99 } }).expect(200);
    expect(res.body.score.commissions).toBe(9);
    expect(res.body.score).toEqual(expectedScore(s, body));
    expect((await row(s.id)).submission).toEqual(body);
  });

  it('scores the stored trials, never trials regenerated from the seed', async () => {
    const s = await startSession(t, token);
    await t.db.update(sessions).set({ seed: 1 }).where(eq(sessions.id, s.id));
    t.clock.advance(PLAUSIBLE_MS);
    const res = await submit(s.id, perfectSubmission(s.plan)).expect(200);
    expect(res.body.score.commissions).toBe(0);
    expect(res.body.score.omissions).toBe(0);
  });

  it('rejects a technically invalid submission with 400 and stores nothing', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = perfectSubmission(s.plan);
    const res = await submit(s.id, { ...body, rts: body.rts.slice(1) }).expect(400);
    expect(res.body.errors).toEqual(['expected 81 trial responses, got 80']);
    expect((await row(s.id)).completedAt).toBeNull();
  });

  it('rejects a session finished faster than the trials allow (422), then accepts it later', async () => {
    const s = await startSession(t, token);
    t.clock.advance(SUBMIT_CONFIG.minElapsedMs - 1);
    await submit(s.id, perfectSubmission(s.plan)).expect(422);
    expect((await row(s.id)).completedAt).toBeNull();
    t.clock.advance(1);
    await submit(s.id, perfectSubmission(s.plan)).expect(200);
  });

  it('rejects an expired session with 422', async () => {
    const onTime = await startSession(t, token);
    const late = await startSession(t, token);
    t.clock.advance(SUBMIT_CONFIG.expiresAfterMs);
    await submit(onTime.id, perfectSubmission(onTime.plan)).expect(200);
    t.clock.advance(1);
    await submit(late.id, perfectSubmission(late.plan)).expect(422);
    expect((await row(late.id)).completedAt).toBeNull();
  });

  it('returns the stored result for an identical retry, and 409 for a different body', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = perfectSubmission(s.plan);
    const first = await submit(s.id, body).expect(200);
    t.clock.advance(5_000);
    const retry = await submit(s.id, body).expect(200);
    expect(retry.body).toEqual(first.body);

    await submit(s.id, pressEverything(s.plan)).expect(409);
    expect((await row(s.id)).score).toEqual(first.body.score);
  });

  it('still returns the stored result for a retry after the session would have expired', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = perfectSubmission(s.plan);
    const first = await submit(s.id, body).expect(200);
    t.clock.advance(SUBMIT_CONFIG.expiresAfterMs);
    const retry = await submit(s.id, body).expect(200);
    expect(retry.body).toEqual(first.body);
  });

  it('stores one result when the same session is submitted twice at once', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const body = perfectSubmission(s.plan);
    const [a, b] = await Promise.all([submit(s.id, body), submit(s.id, body)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body).toEqual(b.body);
  });

  it('accepts only one of two different submissions sent at once', async () => {
    const s = await startSession(t, token);
    t.clock.advance(PLAUSIBLE_MS);
    const [a, b] = await Promise.all([
      submit(s.id, perfectSubmission(s.plan)),
      submit(s.id, pressEverything(s.plan)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    expect((await row(s.id)).score).toEqual(winner.body.score);
  });

  it('returns 404 for a non-existent session and 400 for a malformed id', async () => {
    const s = await startSession(t, token);
    await submit('00000000-0000-4000-8000-000000000000', perfectSubmission(s.plan)).expect(404);
    await submit('not-a-uuid', perfectSubmission(s.plan)).expect(400);
  });
});

describe('isolation between players', () => {
  it("never lets one player submit or see another player's session", async () => {
    const alice = await newPlayer(t);
    const bob = await newPlayer(t);
    const s = await startSession(t, alice);
    t.clock.advance(PLAUSIBLE_MS);

    await submit(s.id, perfectSubmission(s.plan), bob).expect(404);
    expect((await row(s.id)).completedAt).toBeNull();

    await submit(s.id, perfectSubmission(s.plan), alice).expect(200);
    const bobs = await request(t.http).get('/api/sessions').set(auth(bob)).expect(200);
    expect(bobs.body).toEqual([]);
    // Even after Alice completed it, Bob still cannot read it through a retry.
    await submit(s.id, perfectSubmission(s.plan), bob).expect(404);
  });
});

describe('GET /api/sessions', () => {
  it('lists only completed sessions, oldest first', async () => {
    const p = await newPlayer(t);
    const a = await startSession(t, p);
    t.clock.advance(1_000); // distinct start times, so start order and completion order differ
    const b = await startSession(t, p);
    await startSession(t, p); // never submitted
    t.clock.advance(PLAUSIBLE_MS);
    await submit(b.id, perfectSubmission(b.plan), p).expect(200);
    t.clock.advance(1_000);
    await submit(a.id, perfectSubmission(a.plan), p).expect(200);

    const res = await request(t.http).get('/api/sessions').set(auth(p)).expect(200);
    expect(res.body.map((s: CompletedSession) => s.id)).toEqual([b.id, a.id]);
  });
});
