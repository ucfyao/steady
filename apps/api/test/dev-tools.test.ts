import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { players } from '../src/db/schema.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth } from './support/players.js';

// Spec 011 §3: with the development tools on, a new player's group can be chosen.
let t: TestApp;
beforeAll(async () => {
  t = await startTestApp({ devTools: true });
});
afterAll(() => t?.close());

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('choosing a new player’s group (development tools on)', () => {
  it('creates the player in the chosen variant', async () => {
    for (const variant of ['plain', 'calm', 'game'] as const) {
      const { token } = (await request(t.http).post('/api/players').send({ variant }).expect(201))
        .body as { token: string };
      const [row] = await t.db
        .select()
        .from(players)
        .where(eq(players.tokenHash, sha256(token)));
      expect(row!.variant).toBe(variant);
      expect((await request(t.http).get('/api/me').set(auth(token)).expect(200)).body).toEqual({
        variant,
      });
    }
  });

  it('still draws at random without a variant', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { token } = (await request(t.http).post('/api/players').expect(201)).body as {
        token: string;
      };
      seen.add((await request(t.http).get('/api/me').set(auth(token))).body.variant);
    }
    expect([...seen].sort()).toEqual(['calm', 'game', 'plain']);
  });

  it('rejects an unknown variant or extra fields with 400', async () => {
    await request(t.http).post('/api/players').send({ variant: 'loud' }).expect(400);
    await request(t.http).post('/api/players').send({ variant: 'plain', admin: true }).expect(400);
  });
});
