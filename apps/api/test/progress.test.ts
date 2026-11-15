import type { ProgressResponse } from '@steady/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer, playSession, startSession } from './support/players.js';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t?.close());

const progress = async (token: string) =>
  (await request(t.http).get('/api/progress').set(auth(token)).expect(200))
    .body as ProgressResponse;

describe('GET /api/progress', () => {
  it('needs a token', async () => {
    await request(t.http).get('/api/progress').expect(401);
  });

  it('has the full shape but no baseline for a new player', async () => {
    const p = await progress(await newPlayer(t));
    expect(p.summary).toMatchObject({ totalSessions: 0, sessionsUntilBaseline: 6, baseline: null });
    expect(Object.keys(p.checkIn)).toEqual(['sleep', 'stress']);
    expect(Object.keys(p.checkIn.sleep)).toEqual([
      'commissionRate',
      'omissionRate',
      'medianGoRtMs',
      'rtCv',
    ]);
    expect(p.checkIn.stress.rtCv.groups.map((g) => g.key)).toEqual(['low', 'medium', 'high']);
    expect(p.preProbe.groups.map((g) => g.key)).toEqual(['on_task', 'drifting', 'elsewhere']);
  });

  it("sets a baseline after 6 completed sessions and counts only the player's own", async () => {
    const alice = await newPlayer(t);
    const bob = await newPlayer(t);
    for (let i = 0; i < 6; i++) await playSession(t, alice, { sleep: 'good' });
    await startSession(t, alice); // unfinished: not counted
    await playSession(t, bob);

    const a = await progress(alice);
    expect(a.summary.totalSessions).toBe(6);
    expect(a.summary.sessionsUntilBaseline).toBe(0);
    expect(a.summary.baseline?.commissionRate).toEqual({ median: 0, n: 5 });
    // Practice (session 1) is excluded from comparisons: 5 "good" sessions, not 6.
    expect(a.checkIn.sleep.commissionRate.groups[2]).toMatchObject({ key: 'good', n: 5 });
    // 4 probes × 5 non-practice sessions, all answered on task.
    expect(a.preProbe.groups[0]?.n).toBe(20);

    expect((await progress(bob)).summary.totalSessions).toBe(1);
  });
});
