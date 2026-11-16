/**
 * `pnpm seed:demo`: adds a demo player with two weeks of history to the local database
 * (DATABASE_URL), then prints a link that adds it to the browser. Never part of the API.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { seedDemoPlayer } from './demo-player.js';

const WEB_URL = 'http://localhost:5173'; // `pnpm dev`
const NAME = 'Demo';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `pnpm bootstrap` first (it creates .env).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const { token } = await seedDemoPlayer(drizzle(pool, { schema }), new Date());
  // The token goes in the hash, which the browser never sends to a server (apps/web /import).
  const link = `${WEB_URL}/import#${new URLSearchParams({ token, name: NAME }).toString()}`;
  console.log(`
Created a demo player with 10 sessions over the past two weeks
(session 1 practice, sessions 2-6 the starting point, some with a check-in).

With \`pnpm dev\` running, open this link to add it as "${NAME}" and see its Progress:

  ${link}

Your other players stay in the avatar menu. Opening the link again does not add a second copy.
`);
} finally {
  await pool.end();
}
