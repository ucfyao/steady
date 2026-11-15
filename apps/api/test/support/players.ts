import type { CheckIn, InputDevice, StartedSession, Submission } from '@steady/core';
import request from 'supertest';
import type { TestApp } from './app.js';

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function newPlayer(t: TestApp): Promise<string> {
  const res = await request(t.http).post('/api/players').expect(201);
  return res.body.token as string;
}

export async function startSession(
  t: TestApp,
  token: string,
  checkIn?: CheckIn,
  device: InputDevice = 'keyboard',
) {
  const res = await request(t.http)
    .post('/api/sessions')
    .set(auth(token))
    .send(checkIn ? { checkIn, device } : { device })
    .expect(201);
  return res.body as StartedSession;
}

/** Presses every go trial (RT varies a little), withholds every 3, answers "on task". */
export function perfectSubmission(plan: StartedSession['plan']): Submission {
  return {
    rts: plan.trials.map((tr) => (tr.isTarget ? null : 380 + (tr.index % 7) * 10)),
    probeAnswers: plan.probeAfter.map(() => 'on_task'),
  };
}

/** Presses on every trial, including the 3s. */
export function pressEverything(plan: StartedSession['plan']): Submission {
  return { rts: plan.trials.map(() => 300), probeAnswers: plan.probeAfter.map(() => 'drifting') };
}

export const PLAUSIBLE_MS = 150_000; // a real session: 144.9 s of trials plus probes

/** Start, wait a realistic time, submit a perfect session. */
export async function playSession(t: TestApp, token: string, checkIn?: CheckIn) {
  const started = await startSession(t, token, checkIn);
  t.clock.advance(PLAUSIBLE_MS);
  await request(t.http)
    .post(`/api/sessions/${started.id}/submit`)
    .set(auth(token))
    .send(perfectSubmission(started.plan))
    .expect(200);
  return started;
}
