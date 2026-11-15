import type { CheckIn, InputDevice, PlanTrial, SessionScore, Submission } from '@steady/core';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** No names, emails, IPs or user agents: a player is only a token hash. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    seed: integer('seed').notNull(),
    // The exact trials shown, so scoring never depends on regenerating them from the seed.
    trials: jsonb('trials').$type<PlanTrial[]>().notNull(),
    probeAfter: jsonb('probe_after').$type<number[]>().notNull(),
    checkIn: jsonb('check_in').$type<CheckIn>(),
    // One input method per session, so keyboard and touch RTs are never mixed.
    device: text('device').$type<InputDevice>().notNull(),
    startedAt: ts('started_at').notNull(),
    completedAt: ts('completed_at'),
    // Raw responses are kept so a future scoring version can re-score history.
    submission: jsonb('submission').$type<Submission>(),
    score: jsonb('score').$type<SessionScore>(),
    scoringVersion: integer('scoring_version'),
  },
  (t) => [index('sessions_player_completed_idx').on(t.playerId, t.completedAt)],
);
