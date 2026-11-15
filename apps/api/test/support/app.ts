import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { AppConfig } from '../../src/config.js';
import * as schema from '../../src/db/schema.js';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface TestApp {
  http: ReturnType<NestExpressApplication['getHttpServer']>;
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** Stops the database, to test how the app behaves without it. */
  stopDatabase(): Promise<void>;
  close(): Promise<void>;
}

/** The real app (same setup as main.ts) on a fresh Postgres 17 with committed migrations applied. */
export async function startTestApp(overrides: Partial<AppConfig> = {}): Promise<TestApp> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17-alpine',
  ).start();
  const databaseUrl = container.getConnectionUri();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });

  const config: AppConfig = {
    databaseUrl,
    port: 0,
    logLevel: 'silent',
    prettyLogs: false,
    ...overrides,
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
  }).compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false }),
  );
  await app.init();

  let stopped = false;
  return {
    http: app.getHttpServer(),
    db,
    async stopDatabase() {
      await pool.end();
      await container.stop();
      stopped = true;
    },
    async close() {
      await app.close();
      if (!stopped) {
        await pool.end();
        await container.stop();
      }
    },
  };
}
