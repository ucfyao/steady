/**
 * `pnpm seed:demo`: adds a demo player with two weeks of history to the local database
 * (DATABASE_URL), then prints how to switch to it in the browser. Never part of the API.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { seedDemoPlayer } from './demo-player.js';

const PROFILES_KEY = 'steady.players.v1'; // apps/web/src/players/store.ts
const NAME = 'Demo';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `pnpm bootstrap` first (it creates .env).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const { token } = await seedDemoPlayer(drizzle(pool, { schema }), new Date());
  // Adds the profile next to any existing ones on this device and makes it active.
  const snippet =
    `(()=>{const k=${JSON.stringify(PROFILES_KEY)};` +
    `const s=JSON.parse(localStorage.getItem(k)||'{"profiles":[]}');` +
    `const p={id:crypto.randomUUID(),name:${JSON.stringify(NAME)},token:${JSON.stringify(token)}};` +
    `s.profiles.push(p);s.activeId=p.id;localStorage.setItem(k,JSON.stringify(s));location.assign('/progress')})()`;
  console.log(`
Created a demo player with 10 sessions over the past two weeks
(session 1 practice, sessions 2-6 the starting point, some with a check-in).

To switch to it:
  1. Run \`pnpm dev\` and open http://localhost:5173
  2. Open the browser's developer console (Chrome may ask you to type "allow pasting")
  3. Paste and run:

${snippet}

The page opens Progress as "${NAME}". Your other players stay in the avatar menu.
`);
} finally {
  await pool.end();
}
