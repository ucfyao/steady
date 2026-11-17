import { readFileSync } from 'node:fs';
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
      `insert into players (token_hash, variant, name) values (md5(random()::text), 'calm', 'P') returning id`,
    )
  ).rows[0]!.id;

const newSession = (playerId: string) =>
  pool.query(
    `insert into sessions (player_id, seed, trials, probe_after, device, variant, started_at)
     values ($1, 1, '[]', '[]', 'keyboard', 'calm', now())`,
    [playerId],
  );

describe('committed migrations (Spec 003 storage)', () => {
  it('create players with an id, a token hash, a timestamp, a group and a name', async () => {
    expect(await columns('players')).toEqual(['created_at', 'id', 'name', 'token_hash', 'variant']);
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
      'variant',
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
    await pool.query(
      `insert into players (token_hash, variant, name) values ('same', 'calm', 'P')`,
    );
    await expect(
      pool.query(`insert into players (token_hash, variant, name) values ('same', 'calm', 'P')`),
    ).rejects.toThrow(/unique/);
  });
});

describe('migration 0002 (Spec 005): sessions of the old length are deleted', () => {
  const trials = (n: number) =>
    JSON.stringify(Array.from({ length: n }, (_, index) => ({ index })));
  const sessionWith = (playerId: string, n: number) =>
    pool.query(
      `insert into sessions (player_id, seed, trials, probe_after, device, variant, started_at)
       values ($1, 1, $2, '[]', 'keyboard', 'calm', now())`,
      [playerId, trials(n)],
    );

  it('deletes every session without 81 trials and keeps the players and 81-trial sessions', async () => {
    await pool.query('delete from sessions');
    const player = await newPlayer();
    await sessionWith(player, 126);
    await sessionWith(player, 126);
    await sessionWith(player, 81);

    const sql = readFileSync(`${MIGRATIONS}/0002_delete_old_sessions.sql`, 'utf8');
    await pool.query(sql);

    const { rows } = await pool.query<{ n: number }>(
      'select jsonb_array_length(trials) as n from sessions',
    );
    expect(rows).toEqual([{ n: 81 }]);
    const players = await pool.query('select id from players where id = $1', [player]);
    expect(players.rowCount).toBe(1);
  });

  it('0004 names existing players "Player", then requires a name (Spec 013)', async () => {
    await pool.query('alter table players drop column name');
    const { rows } = await pool.query<{ id: string }>(
      `insert into players (token_hash, variant) values (md5(random()::text), 'calm') returning id`,
    );
    await pool.query(readFileSync(`${MIGRATIONS}/0004_player_name.sql`, 'utf8'));

    const named = await pool.query('select name from players where id = $1', [rows[0]!.id]);
    expect(named.rows).toEqual([{ name: 'Player' }]);
    await expect(
      pool.query(`insert into players (token_hash, variant) values (md5(random()::text), 'calm')`),
    ).rejects.toThrow(/null value in column "name"/);
  });
});
