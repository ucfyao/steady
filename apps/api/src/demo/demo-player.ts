import {
  VARIANTS,
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
  type Variant,
} from '@steady/core';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashToken } from '../auth/token.js';
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

/**
 * A demo player's fixed token (Spec 011 §2): SHA-256 of a name per variant, base64url, so it
 * has the 43 characters of a real token and its import link never changes. Local data only.
 */
export const demoToken = (variant: Variant, kind: DemoKind = 'history') =>
  createHash('sha256')
    .update(kind === 'new' ? `steady-demo-new-${variant}` : `steady-demo-${variant}`)
    .digest('base64url');

/** Spec 011 §2: a demo player with two weeks of history, or a new one with no sessions. */
export type DemoKind = 'history' | 'new';
export const DEMO_KINDS: readonly DemoKind[] = ['history', 'new'];

/**
 * A demo player's name (Spec 011 §2): `O-` (old: has history) or `N-` (new: no sessions), then
 * a first name whose initial stands for the group (A plain, B calm, C game).
 */
const DEMO_FIRST_NAMES: Record<DemoKind, Record<Variant, string>> = {
  history: { plain: 'Ava', calm: 'Ben', game: 'Cleo' },
  new: { plain: 'Amy', calm: 'Bella', game: 'Cora' },
};
export const demoName = (variant: Variant, kind: DemoKind) =>
  `${kind === 'history' ? 'O' : 'N'}-${DEMO_FIRST_NAMES[kind][variant]}`;

/**
 * Sets up the demo player of one variant (the game by default, so reviewers see the points on
 * Results; Spec 011 seeds one per variant and kind): with history, or new (no sessions). Its
 * token is fixed, so a rerun replaces the same player (history rebuilt as of `now` and scored
 * by the current rules; a new player emptied again) rather than adding a copy. Returns the token.
 */
export async function seedDemoPlayer(
  db: Db,
  now: Date,
  variant: Variant = 'game',
  kind: DemoKind = 'history',
): Promise<{ token: string }> {
  const token = demoToken(variant, kind);
  const history = kind === 'history' ? demoSessions(now) : [];
  // Oldest first in the shared list (Spec 016): all created when the history starts, a
  // millisecond apart by group and then kind, so the list reads O-Ava, N-Amy, O-Ben, N-Bella,
  // O-Cleo, N-Cora rather than an order left to their random ids.
  const since = demoSessions(now)[0]!.startedAt.getTime();
  const createdAt = new Date(
    since + VARIANTS.indexOf(variant) * DEMO_KINDS.length + DEMO_KINDS.indexOf(kind),
  );
  await db.transaction(async (tx) => {
    // The sessions go with the player (ON DELETE CASCADE).
    await tx.delete(players).where(eq(players.tokenHash, hashToken(token)));
    const [player] = await tx
      .insert(players)
      .values({
        tokenHash: hashToken(token),
        token,
        createdAt,
        variant,
        name: demoName(variant, kind),
      })
      .returning({ id: players.id });
    if (history.length === 0) return;
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
          variant,
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
