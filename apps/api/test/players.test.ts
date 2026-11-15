import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { players } from '../src/db/schema.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer } from './support/players.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

// Independent of the implementation: plain Node crypto.
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const playerRow = async (token: string) =>
  (
    await t.db
      .select()
      .from(players)
      .where(eq(players.tokenHash, sha256(token)))
  )[0];

describe('POST /api/players', () => {
  it('returns a 256-bit base64url token and stores only its hash', async () => {
    const res = await request(t.http).post('/api/players').expect(201);
    const { token } = res.body as { token: string };
    expect(Object.keys(res.body)).toEqual(['token']);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes → 43 base64url characters

    expect(await playerRow(token)).toBeDefined();
    const all = await t.db.select().from(players);
    expect(JSON.stringify(all)).not.toContain(token);
  });

  it('gives every player a different token', async () => {
    expect(await newPlayer(t)).not.toBe(await newPlayer(t));
  });
});

describe('PlayerGuard', () => {
  it.each([
    ['no header', {}],
    ['wrong scheme', { Authorization: 'Basic abc' }],
    ['malformed token', { Authorization: 'Bearer not-a-token' }],
    ['unknown token', auth('A'.repeat(43))],
  ])('rejects %s with 401', async (_name, headers) => {
    await request(t.http).delete('/api/me').set(headers).expect(401);
  });

  it('keeps health public', async () => {
    await request(t.http).get('/api/health').expect(200);
  });
});

describe('DELETE /api/me', () => {
  it('deletes only the calling player, and their token stops working', async () => {
    const token = await newPlayer(t);
    const other = await newPlayer(t);

    await request(t.http).delete('/api/me').set(auth(token)).expect(204);

    expect(await playerRow(token)).toBeUndefined();
    await request(t.http).delete('/api/me').set(auth(token)).expect(401);
    expect(await playerRow(other)).toBeDefined();
  });
});
