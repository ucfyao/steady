import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/app.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const res = await request(t.http).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(t.http).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves routes only under the /api prefix', async () => {
    expect((await request(t.http).get('/health')).status).toBe(404);
  });

  // Last: it stops the database for the rest of this file.
  it('answers 503 when the database is down', async () => {
    await t.stopDatabase();
    const res = await request(t.http).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'unavailable' });
  });
});
