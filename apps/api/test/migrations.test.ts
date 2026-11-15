import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

const columns = async (table: string) =>
  (
    await pool.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
       where table_name = $1 order by column_name`,
      [table],
    )
  ).rows.map((r) => `${r.column_name}${r.is_nullable === 'YES' ? '?' : ''}`);

const newPlayer = async () =>
  (
    await pool.query<{ id: string }>(
      `insert into players (token_hash) values (md5(random()::text)) returning id`,
    )
  ).rows[0]!.id;

const newSession = (playerId: string) =>
  pool.query(
    `insert into sessions (player_id, seed, trials, probe_after, device, started_at)
     values ($1, 1, '[]', '[]', 'keyboard', now())`,
    [playerId],
  );

describe('committed migrations (Spec 003 storage)', () => {
  it('create players with only an id, a token hash and a timestamp', async () => {
    expect(await columns('players')).toEqual(['created_at', 'id', 'token_hash']);
  });

  it('create sessions with trials, raw submission and score kept per row', async () => {
    expect(await columns('sessions')).toEqual([
      'check_in?',
      'completed_at?',
      'device',
      'id',
      'player_id',
      'probe_after',
      'score?',
      'scoring_version?',
      'seed',
      'started_at',
      'submission?',
      'trials',
    ]);
  });

  it('reject a session for a player that does not exist', async () => {
    await expect(newSession('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/foreign key/);
  });

  it('delete a player’s sessions together with the player', async () => {
    const keep = await newPlayer();
    const gone = await newPlayer();
    await newSession(keep);
    await newSession(gone);
    await newSession(gone);

    await pool.query('delete from players where id = $1', [gone]);
    const { rows } = await pool.query<{ player_id: string }>('select player_id from sessions');
    expect(rows.map((r) => r.player_id)).toEqual([keep]);
  });

  it('reject a duplicate token hash', async () => {
    await pool.query(`insert into players (token_hash) values ('same')`);
    await expect(pool.query(`insert into players (token_hash) values ('same')`)).rejects.toThrow(
      /unique/,
    );
  });
});
