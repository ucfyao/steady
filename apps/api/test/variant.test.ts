import { createHash } from 'node:crypto';
import type { CompletedSession } from '@steady/core';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { players, sessions } from '../src/db/schema.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer, PLAUSIBLE_MS, perfectSubmission } from './support/players.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const variantOf = async (token: string) =>
  (
    await t.db
      .select()
      .from(players)
      .where(eq(players.tokenHash, sha256(token)))
  )[0]!.variant;

const start = (token: string, body: object = {}) =>
  request(t.http)
    .post('/api/sessions')
    .set(auth(token))
    .send({ device: 'keyboard', ...body });

// Spec 006 §5: a new player is put in calm or game at random, and keeps it.
describe('A/B variant', () => {
  it('assigns each new player calm or game, and both occur', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(await variantOf(await newPlayer(t)));
    expect([...seen].sort()).toEqual(['calm', 'game']);
  });

  it('tells the player their variant (GET /api/me), so practice can show it', async () => {
    const token = await newPlayer(t);
    const res = await request(t.http).get('/api/me').set(auth(token)).expect(200);
    expect(res.body).toEqual({ variant: await variantOf(token) });
    await request(t.http).get('/api/me').expect(401);
  });

  it('records the player’s variant on each session and returns it', async () => {
    const token = await newPlayer(t);
    const variant = await variantOf(token);
    const s = (await start(token).expect(201)).body;
    expect(s.variant).toBe(variant);
    const [row] = await t.db.select().from(sessions).where(eq(sessions.id, s.id));
    expect(row!.variant).toBe(variant);

    t.clock.advance(PLAUSIBLE_MS);
    const done = (
      await request(t.http)
        .post(`/api/sessions/${s.id}/submit`)
        .set(auth(token))
        .send(perfectSubmission(s.plan))
        .expect(200)
    ).body as CompletedSession;
    expect(done.variant).toBe(variant);
    const list = (await request(t.http).get('/api/sessions').set(auth(token)).expect(200))
      .body as CompletedSession[];
    expect(list[0]!.variant).toBe(variant);
  });

  it('lets a play-test override the variant for one session, and stores what was shown', async () => {
    const token = await newPlayer(t);
    const other = (await variantOf(token)) === 'calm' ? 'game' : 'calm';
    const s = (await start(token, { variant: other }).expect(201)).body;
    expect(s.variant).toBe(other);
    const [row] = await t.db.select().from(sessions).where(eq(sessions.id, s.id));
    expect(row!.variant).toBe(other);
    // The player's own variant is unchanged.
    expect(await variantOf(token)).not.toBe(other);
  });

  it('rejects an unknown variant with 400', async () => {
    const token = await newPlayer(t);
    const res = await start(token, { variant: 'loud' }).expect(400);
    expect(res.body.errors).toEqual([expect.stringContaining('variant')]);
  });

  it('stores the points in the score (scoring version 4)', async () => {
    const token = await newPlayer(t);
    const s = (await start(token).expect(201)).body;
    t.clock.advance(PLAUSIBLE_MS);
    const done = (
      await request(t.http)
        .post(`/api/sessions/${s.id}/submit`)
        .set(auth(token))
        .send(perfectSubmission(s.plan))
        .expect(200)
    ).body as CompletedSession;
    expect(done.score.scoringVersion).toBe(4);
    expect(done.score.points).toBeGreaterThan(0);
  });
});
