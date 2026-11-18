import type {
  CheckIn,
  InputDevice,
  PlanTrial,
  SessionScore,
  Submission,
  Variant,
} from '@steady/core';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** No names, emails, IPs or user agents: a player is only a token hash. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
  // The A/B group (Spec 006), drawn at random when the player is created, then fixed.
  variant: text('variant').$type<Variant>().notNull(),
  // The player's name (Spec 013): trimmed, 1 to 30 characters, validated by the API.
  name: text('name').notNull(),
  // Spec 016: kept in plain text so GET /api/players can hand it out (an accepted trade-off
  // for this project). Lookups still go through token_hash. Null for players made before it.
  token: text('token'),
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
    // What the session showed: always the player's variant (Spec 006, Spec 027).
    variant: text('variant').$type<Variant>().notNull(),
    startedAt: ts('started_at').notNull(),
    completedAt: ts('completed_at'),
    // Raw responses are kept so a future scoring version can re-score history.
    submission: jsonb('submission').$type<Submission>(),
    score: jsonb('score').$type<SessionScore>(),
    scoringVersion: integer('scoring_version'),
  },
  (t) => [index('sessions_player_completed_idx').on(t.playerId, t.completedAt)],
);
