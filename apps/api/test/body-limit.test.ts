import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer } from './support/players.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

describe('JSON body limit', () => {
  it('rejects a body over 32 kB with 413', async () => {
    const token = await newPlayer(t);
    const res = await request(t.http)
      .post('/api/sessions')
      .set(auth(token))
      .send({ checkIn: null, padding: 'x'.repeat(33 * 1024) });
    expect(res.status).toBe(413);
  });
});
