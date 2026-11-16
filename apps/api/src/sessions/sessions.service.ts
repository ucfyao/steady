import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  SART_CONFIG,
  SUBMIT_CONFIG,
  SubmissionSchema,
  createSessionPlan,
  scoreSession,
  validateSubmission,
  type CheckIn,
  type InputDevice,
  type CompletedSession,
  type StartedSession,
  type Submission,
  type Variant,
} from '@steady/core';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { CLOCK, type Clock } from '../clock.js';
import { DB, type Db } from '../db/db.module.js';
import { players, sessions } from '../db/schema.js';

type SessionRow = typeof sessions.$inferSelect;

const sameSubmission = (a: Submission, b: Submission) =>
  a.rts.length === b.rts.length &&
  a.rts.every((rt, i) => rt === b.rts[i]) &&
  a.probeAnswers.length === b.probeAnswers.length &&
  a.probeAnswers.every((ans, i) => ans === b.probeAnswers[i]);

function toCompleted(row: SessionRow): CompletedSession {
  if (!row.completedAt || !row.score) throw new Error(`session ${row.id} is not completed`);
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    checkIn: row.checkIn ?? null,
    device: row.device,
    variant: row.variant,
    score: row.score,
  };
}

/** Every query filters on player_id, so another player's session is simply "not found". */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async start(
    playerId: string,
    checkIn: CheckIn | null,
    device: InputDevice,
    override?: Variant,
  ): Promise<StartedSession> {
    const variant = override ?? (await this.variantOf(playerId));
    const seed = randomInt(2 ** 31 - 1); // server-chosen; fits a Postgres integer
    const { trials, probeAfter } = createSessionPlan(seed);
    const [row] = await this.db
      .insert(sessions)
      .values({
        playerId,
        seed,
        trials,
        probeAfter,
        checkIn,
        device,
        variant,
        startedAt: this.clock.now(),
      })
      .returning({ id: sessions.id, startedAt: sessions.startedAt });
    return {
      id: row!.id,
      startedAt: row!.startedAt.toISOString(),
      variant,
      plan: { trials, probeAfter },
    };
  }

  async submit(playerId: string, id: string, body: unknown): Promise<CompletedSession> {
    const row = await this.find(playerId, id);
    const plan = { seed: row.seed, trials: row.trials, probeAfter: row.probeAfter };

    const validation = validateSubmission(plan, body);
    if (!validation.ok) {
      throw new BadRequestException({ message: 'Invalid submission', errors: validation.errors });
    }
    const submission = SubmissionSchema.parse(body); // drops unknown fields, e.g. a client "score"

    if (row.completedAt) return this.replay(row, submission);

    const now = this.clock.now();
    const elapsed = now.getTime() - row.startedAt.getTime();
    if (elapsed < SUBMIT_CONFIG.minElapsedMs) {
      throw new UnprocessableEntityException('Session finished faster than its trials allow');
    }
    if (elapsed > SUBMIT_CONFIG.expiresAfterMs) {
      throw new UnprocessableEntityException('Session expired; start a new one');
    }

    const score = scoreSession(plan, submission);
    const [updated] = await this.db
      .update(sessions)
      .set({ completedAt: now, submission, score, scoringVersion: SART_CONFIG.scoringVersion })
      .where(
        and(eq(sessions.id, id), eq(sessions.playerId, playerId), isNull(sessions.completedAt)),
      )
      .returning();
    // Lost a race with a concurrent submit: treat it like a retry.
    return updated ? toCompleted(updated) : this.replay(await this.find(playerId, id), submission);
  }

  async listCompleted(playerId: string): Promise<CompletedSession[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.playerId, playerId), isNotNull(sessions.completedAt)))
      .orderBy(asc(sessions.completedAt));
    return rows.map(toCompleted);
  }

  private async variantOf(playerId: string): Promise<Variant> {
    const [row] = await this.db
      .select({ variant: players.variant })
      .from(players)
      .where(eq(players.id, playerId));
    if (!row) throw new NotFoundException();
    return row.variant;
  }

  private async find(playerId: string, id: string): Promise<SessionRow> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.playerId, playerId)));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Same body again: return the stored result (safe client retry). Different body: conflict. */
  private replay(row: SessionRow, submission: Submission): CompletedSession {
    if (!row.submission || !sameSubmission(row.submission, submission)) {
      throw new ConflictException('Session already submitted with different responses');
    }
    return toCompleted(row);
  }
}
