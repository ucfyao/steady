import {
  createSessionPlan,
  scoreSession,
  validateSubmission,
  type CompletedSession,
  type ProgressResponse,
} from '@steady/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessions } from '../src/db/schema.js';
import { demoSessions, seedDemoPlayer } from '../src/demo/demo-player.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer } from './support/players.js';

const NOW = new Date(2026, 10, 16, 14, 0); // local time, so the day checks hold in any zone
const DAY = 86_400_000;

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

describe('demo player (pnpm seed:demo)', () => {
  it('stores 10 valid sessions, scored by scoreSession, readable with the printed token', async () => {
    const { token } = await seedDemoPlayer(t.db, NOW);
    const list = (await request(t.http).get('/api/sessions').set(auth(token)).expect(200))
      .body as CompletedSession[];
    expect(list).toHaveLength(10);

    const rows = await t.db.select().from(sessions);
    for (const row of rows) {
      // The plan is the one the seed generates, and the score is core's, not made up.
      const plan = createSessionPlan(row.seed);
      expect(row.trials).toEqual(plan.trials);
      expect(validateSubmission(plan, row.submission)).toEqual({ ok: true });
      expect(row.score).toEqual(scoreSession(plan, row.submission!));
    }

    // Spread over the past two weeks, oldest first, never in the future.
    const times = list.map((s) => new Date(s.completedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(NOW.getTime() - times[0]!).toBeLessThan(14 * DAY);
    expect(times.at(-1)!).toBeLessThan(NOW.getTime());
    expect(list.filter((s) => s.checkIn !== null).length).toBeGreaterThanOrEqual(4);
  });

  it('gives Progress a baseline (practice + 5) and a recent block', async () => {
    const { token } = await seedDemoPlayer(t.db, NOW);
    const p = (await request(t.http).get('/api/progress').set(auth(token)).expect(200))
      .body as ProgressResponse;
    expect(p.summary).toMatchObject({ totalSessions: 10, sessionsUntilBaseline: 0 });
    expect(p.summary.baseline?.commissionRate.n).toBe(5);
    expect(p.summary.recent?.commissionRate.n).toBe(5);
  });

  it('is a separate player: nobody else sees its sessions', async () => {
    await seedDemoPlayer(t.db, NOW);
    const other = await newPlayer(t);
    expect((await request(t.http).get('/api/sessions').set(auth(other)).expect(200)).body).toEqual(
      [],
    );
  });

  it('is the same history on every run, apart from the token', () => {
    expect(demoSessions(NOW)).toEqual(demoSessions(NOW));
    const ids = demoSessions(NOW).map((s) => s.plan.seed);
    expect(new Set(ids).size).toBe(10);
  });
});
