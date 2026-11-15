import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { APP_CONFIG, type AppConfig } from '../config.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');
const POOL = Symbol('POOL');

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
        // An idle client can lose its connection (e.g. the database restarts). Without a
        // listener, pg's 'error' event is unhandled and crashes the process; the next
        // query simply gets a new connection or fails with a normal error instead.
        pool.on('error', (err) =>
          new Logger('Database').error(`idle client error: ${err.message}`),
        );
        return pool;
      },
    },
    { provide: DB, inject: [POOL], useFactory: (pool: pg.Pool): Db => drizzle(pool, { schema }) },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
