import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { players, sessions } from '../src/db/schema.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer, playSession } from './support/players.js';

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
  it('returns a 256-bit base64url token, looked up by its hash and kept for the list (Spec 016)', async () => {
    const res = await request(t.http).post('/api/players').send({ name: 'Ana' }).expect(201);
    const { token } = res.body as { token: string };
    expect(Object.keys(res.body)).toEqual(['token']);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes → 43 base64url characters

    // Found by its hash; the plain token is kept too, so GET /api/players can hand it out.
    expect((await playerRow(token))!.token).toBe(token);
  });

  it('gives every player a different token', async () => {
    expect(await newPlayer(t)).not.toBe(await newPlayer(t));
  });

  it('stores the trimmed name with the player (Spec 013)', async () => {
    const token = await newPlayer(t, '  Ana  ');
    expect((await playerRow(token))!.name).toBe('Ana');
  });

  it.each([
    ['no body', undefined],
    ['no name', {}],
    ['a blank name', { name: '   ' }],
    ['a name over 30 characters', { name: 'x'.repeat(31) }],
    ['a name that is not text', { name: 7 }],
    ['an extra field', { name: 'Ana', admin: true }],
  ])('rejects %s with 400 and creates nobody', async (_case, body) => {
    const before = (await t.db.select().from(players)).length;
    const req = request(t.http).post('/api/players');
    await (body === undefined ? req : req.send(body)).expect(400);
    expect((await t.db.select().from(players)).length).toBe(before);
  });

  it('accepts a name of exactly 30 characters, and the same name twice', async () => {
    await newPlayer(t, 'x'.repeat(30));
    await newPlayer(t, 'Same');
    await newPlayer(t, 'Same');
  });
});

describe('GET and PATCH /api/me (Spec 013)', () => {
  const me = (token: string) => request(t.http).get('/api/me').set(auth(token));
  const rename = (token: string, body: unknown) =>
    request(t.http)
      .patch('/api/me')
      .set(auth(token))
      .send(body as object);

  it("returns the player's name and group", async () => {
    const token = await newPlayer(t, 'Ana');
    const { body } = await me(token).expect(200);
    expect(body).toEqual({ name: 'Ana', variant: (await playerRow(token))!.variant });
  });

  it('renames only the calling player, trims the name, and returns the player', async () => {
    const token = await newPlayer(t, 'Ana');
    const other = await newPlayer(t, 'Ben');
    const { body } = await rename(token, { name: '  Anna ' }).expect(200);
    expect(body).toEqual({ name: 'Anna', variant: (await playerRow(token))!.variant });
    expect((await me(token)).body.name).toBe('Anna');
    expect((await me(other)).body.name).toBe('Ben');
  });

  it.each([
    ['no name', {}],
    ['a blank name', { name: '' }],
    ['a name over 30 characters', { name: 'x'.repeat(31) }],
    ['another field', { name: 'Ana', variant: 'game' }],
  ])('rejects %s with 400 and keeps the name', async (_case, body) => {
    const token = await newPlayer(t, 'Ana');
    await rename(token, body).expect(400);
    expect((await me(token)).body.name).toBe('Ana');
  });

  it('needs a valid token', async () => {
    await request(t.http).patch('/api/me').send({ name: 'Ana' }).expect(401);
    await rename('A'.repeat(43), { name: 'Ana' }).expect(401);
  });
});

describe('GET /api/players (Spec 016)', () => {
  type Item = {
    id: string;
    name: string;
    variant: string;
    token: string;
    completedSessions: number;
    createdAt: string;
  };
  const list = async () => (await request(t.http).get('/api/players').expect(200)).body as Item[];

  it('lists every player, oldest first, with name, group, token and completed sessions', async () => {
    t.clock.advance(1_000);
    const ana = await newPlayer(t, 'Ana');
    t.clock.advance(1_000);
    const ben = await newPlayer(t, 'Ben');
    await playSession(t, ben);

    const items = await list();
    const byToken = (tok: string) => items.find((i) => i.token === tok)!;
    expect(byToken(ana)).toMatchObject({ name: 'Ana', completedSessions: 0 });
    expect(byToken(ben)).toMatchObject({ name: 'Ben', completedSessions: 1 });
    expect(byToken(ana).variant).toBe((await playerRow(ana))!.variant);
    expect(byToken(ana).id).toBe((await playerRow(ana))!.id);
    const times = items.map((i) => new Date(i.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(items.indexOf(byToken(ana))).toBeLessThan(items.indexOf(byToken(ben)));
  });

  it('needs no token, and a listed token works for that player', async () => {
    const token = await newPlayer(t, 'Cy');
    const item = (await list()).find((i) => i.token === token)!;
    const me = await request(t.http).get('/api/me').set(auth(item.token)).expect(200);
    expect(me.body.name).toBe('Cy');
  });

  it('drops a deleted player, and leaves out players without a stored token', async () => {
    const token = await newPlayer(t, 'Gone');
    await request(t.http).delete('/api/me').set(auth(token)).expect(204);
    await t.db
      .insert(players)
      .values({ tokenHash: sha256('legacy'), variant: 'calm', name: 'Old' });
    const names = (await list()).map((i) => i.name);
    expect(names).not.toContain('Gone');
    expect(names).not.toContain('Old');
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

  it("removes the player's sessions too, and leaves other players' sessions alone", async () => {
    const token = await newPlayer(t);
    const other = await newPlayer(t);
    await playSession(t, token);
    await playSession(t, other);
    const me = await playerRow(token);

    await request(t.http).delete('/api/me').set(auth(token)).expect(204);

    expect(await t.db.select().from(sessions).where(eq(sessions.playerId, me!.id))).toEqual([]);
    const res = await request(t.http).get('/api/sessions').set(auth(other)).expect(200);
    expect(res.body).toHaveLength(1);
  });
});
