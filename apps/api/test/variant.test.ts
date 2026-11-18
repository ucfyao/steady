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

// Spec 006 §5, Spec 008 §2: a new player is put in plain, calm or game at random, and keeps it.
describe('A/B variant', () => {
  it('assigns each new player plain, calm or game, and all three occur', async () => {
    // 60 players: the chance that one group never comes up is 3 × (2/3)^60, about 1e-10.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(await variantOf(await newPlayer(t)));
    expect([...seen].sort()).toEqual(['calm', 'game', 'plain']);
  });

  it('tells the player their variant (GET /api/me), so practice can show it', async () => {
    const token = await newPlayer(t);
    const res = await request(t.http).get('/api/me').set(auth(token)).expect(200);
    expect(res.body).toEqual({ name: 'Test player', variant: await variantOf(token) });
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

  it('records the player’s group even when a variant is sent (Spec 027)', async () => {
    const token = await newPlayer(t);
    const own = await variantOf(token);
    for (const sent of ['plain', 'calm', 'game'] as const) {
      const s = (await start(token, { variant: sent }).expect(201)).body;
      expect(s.variant).toBe(own);
      const [row] = await t.db.select().from(sessions).where(eq(sessions.id, s.id));
      expect(row!.variant).toBe(own);
    }
  });

  it('creates a new player in a chosen variant (Spec 011 §3)', async () => {
    // Five per variant: a random draw would match all 15 only once in 3^15 (about 14 million).
    for (const variant of ['plain', 'calm', 'game'] as const)
      for (let i = 0; i < 5; i++) {
        const { token } = (
          await request(t.http).post('/api/players').send({ name: 'P', variant }).expect(201)
        ).body as { token: string };
        expect(await variantOf(token)).toBe(variant);
      }
  });

  it('rejects an unknown variant or extra fields for a new player with 400', async () => {
    await request(t.http).post('/api/players').send({ name: 'P', variant: 'loud' }).expect(400);
    await request(t.http)
      .post('/api/players')
      .send({ name: 'P', variant: 'plain', admin: true })
      .expect(400);
  });

  it('stores no points: they are always derived from the trial outcomes (Spec 006 §3)', async () => {
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
    expect(done.score.scoringVersion).toBe(3);
    expect(done.score).not.toHaveProperty('points');
  });
});
