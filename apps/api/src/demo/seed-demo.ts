/**
 * `pnpm seed:demo`: adds three demo players, one per variant (Spec 011), each with two weeks
 * of history, to the local database (DATABASE_URL), then prints a link that adds each to the
 * browser. Never part of the API.
 */
import { VARIANTS } from '@steady/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { seedDemoPlayer } from './demo-player.js';

// `pnpm dev`, or another dev server's address (e.g. a second worktree on another port).
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `pnpm bootstrap` first (it creates .env).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const db = drizzle(pool, { schema });
  const now = new Date();
  const links: string[] = [];
  for (const variant of VARIANTS) {
    const { token } = await seedDemoPlayer(db, now, variant);
    const name = `Demo ${variant}`;
    // The token goes in the hash, which the browser never sends to a server (apps/web /import).
    links.push(
      `  ${name.padEnd(11)} ${WEB_URL}/import#${new URLSearchParams({ token, name }).toString()}`,
    );
  }
  console.log(`
Created three demo players, one per variant (plain, calm, game), each with 10 sessions over
the past two weeks (session 1 not counted, sessions 2-6 the starting point, some with a check-in).

With the web app running, open each link to add that player and see its Progress:

${links.join('\n')}

Switch between them in the avatar menu: each shows its own variant on every screen.
Opening a link again does not add a second copy.
`);
} finally {
  await pool.end();
}
