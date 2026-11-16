import {
  SART_CONFIG,
  TRIAL_MS,
  createSessionPlan,
  mulberry32,
  scoreSession,
  validateSubmission,
  type CheckIn,
  type ProbeAnswer,
  type SessionPlan,
  type Submission,
} from '@steady/core';
import { newToken, hashToken } from '../auth/token.js';
import type { Db } from '../db/db.module.js';
import { players, sessions } from '../db/schema.js';

/**
 * A demo player for reviewers (`pnpm seed:demo`): 10 sessions over the past two weeks,
 * session 1 practice, sessions 2–6 the baseline, some with a check-in. Only the responses are
 * simulated; every score comes from core's `scoreSession`, as in the API. It writes straight
 * to the database because the API (rightly) only accepts a session that has just been played.
 */

/** Days before today, oldest first: three of them fall in the last 7 days. */
const DAYS_AGO = [13, 12, 11, 10, 9, 8, 7, 5, 3, 1];
const CHECK_INS: (CheckIn | null)[] = [
  null,
  { sleep: 'good', stress: 'low' },
  { sleep: 'ok', stress: 'medium' },
  null,
  { sleep: 'poor', stress: 'high' },
  { sleep: 'good' },
  null,
  { sleep: 'ok', stress: 'low' },
  { stress: 'medium' },
  { sleep: 'good', stress: 'low' },
];
const PROBE_ANSWERS: ProbeAnswer[] = ['on_task', 'on_task', 'drifting', 'elsewhere'];
const RANDOM_SEED = 20261116; // fixed, so every run produces the same history

export interface DemoSession {
  plan: SessionPlan;
  submission: Submission;
  checkIn: CheckIn | null;
  startedAt: Date;
  completedAt: Date;
}

/** Simulated key presses for one session; `skill` runs from 0 (first session) to 1. */
function respond(plan: SessionPlan, skill: number, rand: () => number): Submission {
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); // Box–Muller
  const meanRt = 430 - 45 * skill;
  const sdRt = 95 - 30 * skill;
  const pressOnTarget = 0.6 - 0.3 * skill; // a press on a 3 is a commission
  const miss = 0.07 - 0.05 * skill;
  const rt = () => Math.min(TRIAL_MS - 1, Math.max(150, meanRt + sdRt * normal()));

  const rts = plan.trials.map((t) => {
    if (rand() < 0.01) return 30 + rand() * 65; // an anticipation (< 100 ms)
    if (t.isTarget) return rand() < pressOnTarget ? rt() - 20 : null;
    return rand() < miss ? null : rt();
  });
  const probeAnswers = plan.probeAfter.map(
    () => PROBE_ANSWERS[Math.floor(rand() * PROBE_ANSWERS.length)]!,
  );
  return { rts: rts.map((x) => (x === null ? null : Math.round(x * 10) / 10)), probeAnswers };
}

/** The demo history relative to `now`, in the local time zone, oldest first. */
export function demoSessions(now: Date): DemoSession[] {
  const rand = mulberry32(RANDOM_SEED);
  // Trials, three probes and the countdown: about 2 minutes.
  const durationMs = SART_CONFIG.digits.length * SART_CONFIG.copiesPerDigit * TRIAL_MS + 30_000;
  return DAYS_AGO.map((ago, i) => {
    const plan = createSessionPlan(Math.floor(rand() * (2 ** 31 - 1)));
    const minutes = 8 * 60 + Math.floor(rand() * 4 * 60); // between 08:00 and 12:00
    const completedAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - ago,
      0,
      minutes,
    );
    return {
      plan,
      submission: respond(plan, i / (DAYS_AGO.length - 1), rand),
      checkIn: CHECK_INS[i] ?? null,
      startedAt: new Date(completedAt.getTime() - durationMs),
      completedAt,
    };
  });
}

/** Creates the player and its sessions; returns the player's token (shown once, never stored). */
export async function seedDemoPlayer(db: Db, now: Date): Promise<{ token: string }> {
  const token = newToken();
  const history = demoSessions(now);
  await db.transaction(async (tx) => {
    const [player] = await tx
      .insert(players)
      .values({ tokenHash: hashToken(token), createdAt: history[0]!.startedAt })
      .returning({ id: players.id });
    await tx.insert(sessions).values(
      history.map((s) => {
        const check = validateSubmission(s.plan, s.submission);
        if (!check.ok) throw new Error(`invalid demo submission: ${check.errors.join('; ')}`);
        return {
          playerId: player!.id,
          seed: s.plan.seed,
          trials: s.plan.trials,
          probeAfter: s.plan.probeAfter,
          checkIn: s.checkIn,
          device: 'keyboard' as const,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          submission: s.submission,
          score: scoreSession(s.plan, s.submission),
          scoringVersion: SART_CONFIG.scoringVersion,
        };
      }),
    );
  });
  return { token };
}
