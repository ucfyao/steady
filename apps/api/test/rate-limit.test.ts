import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { startTestApp, type TestApp } from './support/app.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp({ rateLimitPerMinute: 120 });
});
afterAll(() => t?.close());

describe('rate limits (Spec 003 hardening)', () => {
  it('allows 10 new players per minute per client, then answers 429', async () => {
    for (let i = 0; i < 10; i++)
      await request(t.http).post('/api/players').send({ name: 'P' }).expect(201);
    await request(t.http).post('/api/players').send({ name: 'P' }).expect(429);
  });

  it('does not rate-limit the health check (above the 120/min default)', async () => {
    for (let i = 0; i < 130; i++) await request(t.http).get('/api/health').expect(200);
  });
});
