import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHandler, type Handler } from '../src/serverless.js';
import { startMigratedDatabase, testConfig } from './support/app.js';

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let handler: Handler;
beforeAll(async () => {
  ({ container, pool } = await startMigratedDatabase());
  handler = await createHandler(
    testConfig(container.getConnectionUri(), { rateLimitPerMinute: 120 }),
  );
});
afterAll(async () => {
  await handler?.close();
  await pool?.end();
  await container?.stop();
});

describe('serverless handler (Vercel entry)', () => {
  it('serves the API under /api with the same setup as main.ts', async () => {
    const res = await request(handler.listener).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect((await request(handler.listener).get('/health')).status).toBe(404);
  });

  // Behind Vercel's proxy every request arrives from the proxy, so without
  // `trust proxy` all players would share one rate-limit bucket.
  it('rate-limits per client address from X-Forwarded-For', async () => {
    const from = (ip: string) =>
      request(handler.listener).post('/api/players').set('X-Forwarded-For', ip).send({ name: 'P' });
    for (let i = 0; i < 10; i++) await from('203.0.113.1').expect(201);
    await from('203.0.113.1').expect(429);
    await from('203.0.113.2').expect(201);
  });
});
