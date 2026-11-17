import {
  createSessionPlan,
  scoreSession,
  validateSubmission,
  type CompletedSession,
  type ProgressResponse,
} from '@steady/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { players, sessions } from '../src/db/schema.js';
import { demoSessions, seedDemoPlayer } from '../src/demo/demo-player.js';
import { startTestApp, type TestApp } from './support/app.js';
import { auth, newPlayer, playSession } from './support/players.js';

const NOW = new Date(2026, 10, 16, 14, 0); // local time, so the day checks hold in any zone
const DAY = 86_400_000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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

  it('can be seeded in any variant: its group and every session are in it (Spec 011)', async () => {
    for (const variant of ['plain', 'calm', 'game'] as const) {
      const { token } = await seedDemoPlayer(t.db, NOW, variant);
      expect((await request(t.http).get('/api/me').set(auth(token)).expect(200)).body).toEqual({
        name: { plain: 'Ava', calm: 'Ben', game: 'Cleo' }[variant],
        variant,
      });
      const list = (await request(t.http).get('/api/sessions').set(auth(token)).expect(200))
        .body as CompletedSession[];
      expect(list.map((s) => s.variant)).toEqual(Array(10).fill(variant));
    }
  });

  it('has a fixed token per variant, and a rerun refreshes the same player (Spec 011 §2)', async () => {
    const first = await seedDemoPlayer(t.db, NOW, 'calm');
    const later = new Date(NOW.getTime() + 3 * DAY);
    const again = await seedDemoPlayer(t.db, later, 'calm');
    expect(again.token).toBe(first.token);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await seedDemoPlayer(t.db, NOW, 'plain')).token).not.toBe(first.token);

    // One player, ten sessions, rebuilt as of the later run.
    const rows = await t.db
      .select()
      .from(players)
      .where(eq(players.tokenHash, sha256(first.token)));
    expect(rows).toHaveLength(1);
    const list = (await request(t.http).get('/api/sessions').set(auth(first.token)).expect(200))
      .body as CompletedSession[];
    expect(list).toHaveLength(10);
    expect(new Date(list.at(-1)!.completedAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('seeds new demo players with no sessions, and a rerun empties them again (Spec 011 §2)', async () => {
    for (const [variant, name] of [
      ['plain', 'Dana'],
      ['calm', 'Eli'],
      ['game', 'Finn'],
    ] as const) {
      const { token } = await seedDemoPlayer(t.db, NOW, variant, 'new');
      expect(token).not.toBe((await seedDemoPlayer(t.db, NOW, variant)).token);
      const me = await request(t.http).get('/api/me').set(auth(token)).expect(200);
      expect(me.body).toEqual({ name, variant });
      expect((await request(t.http).get('/api/sessions').set(auth(token))).body).toEqual([]);
    }
    // Played once, then seeded again: a new player once more, under the same token.
    const { token } = await seedDemoPlayer(t.db, NOW, 'calm', 'new');
    await playSession(t, token);
    expect((await request(t.http).get('/api/sessions').set(auth(token))).body).toHaveLength(1);
    expect((await seedDemoPlayer(t.db, NOW, 'calm', 'new')).token).toBe(token);
    expect((await request(t.http).get('/api/sessions').set(auth(token))).body).toEqual([]);
  });

  it('lists the demo players as Ava, Ben, Cleo, Dana, Eli, Finn, whatever their ids (Spec 014)', async () => {
    for (let run = 0; run < 3; run++)
      for (const variant of ['game', 'plain', 'calm'] as const)
        for (const kind of ['new', 'history'] as const)
          await seedDemoPlayer(t.db, NOW, variant, kind);
    const names = (
      (await request(t.http).get('/api/players').expect(200)).body as { name: string }[]
    )
      .map((p) => p.name)
      .filter((n) => ['Ava', 'Ben', 'Cleo', 'Dana', 'Eli', 'Finn'].includes(n));
    expect(names).toEqual(['Ava', 'Ben', 'Cleo', 'Dana', 'Eli', 'Finn']);
  });

  it('is the same history on every run', () => {
    expect(demoSessions(NOW)).toEqual(demoSessions(NOW));
    const ids = demoSessions(NOW).map((s) => s.plan.seed);
    expect(new Set(ids).size).toBe(10);
  });
});
