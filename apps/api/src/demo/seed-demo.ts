/**
 * `pnpm seed:demo` (run by `pnpm bootstrap`): sets up six demo players (Spec 011 §2), one per
 * variant with two weeks of history and one per variant with none, named on the server
 * (Spec 013), in the database (DATABASE_URL). Their tokens are fixed, so a rerun refreshes the
 * same players. They appear in everyone's player list (Spec 014). Never part of the API.
 */
import { VARIANTS } from '@steady/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { DEMO_KINDS, DEMO_NAMES, seedDemoPlayer } from './demo-player.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `pnpm bootstrap` first (it creates .env).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const db = drizzle(pool, { schema });
  const now = new Date();
  for (const kind of DEMO_KINDS)
    for (const variant of VARIANTS) await seedDemoPlayer(db, now, variant, kind);
  const names = (kind: 'history' | 'new') =>
    VARIANTS.map((v) => `${DEMO_NAMES[kind][v]} (${v})`).join(', ');
  console.log(`
Set up six demo players (Spec 011 §2):
  With history: ${names('history')}
    10 sessions each over the past two weeks (session 1 not counted, sessions 2-6 the
    starting point, some with a check-in).
  New:          ${names('new')}
    No sessions: a new player's first visit.
Running this again rebuilds the history and empties the new players.

With the web app running, pick them in the avatar menu: each shows its own variant on every screen.
`);
} finally {
  await pool.end();
}
