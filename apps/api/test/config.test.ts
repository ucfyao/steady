import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5433/db' })).toEqual({
      databaseUrl: 'postgres://u:p@localhost:5433/db',
      port: 4000,
      dbPoolMax: 10,
      logLevel: 'info',
      prettyLogs: true,
      rateLimitPerMinute: 120,
    });
  });

  it('refuses to start without a database URL, naming the variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a database URL that is not postgres://', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a bad port and an unknown log level', () => {
    const base = { DATABASE_URL: 'postgres://localhost/db' };
    expect(() => loadConfig({ ...base, API_PORT: 'abc' })).toThrow(/API_PORT/);
    expect(() => loadConfig({ ...base, API_PORT: '70000' })).toThrow(/API_PORT/);
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('reads the pool size, and rejects one below 1', () => {
    const base = { DATABASE_URL: 'postgres://localhost/db' };
    expect(loadConfig({ ...base, DB_POOL_MAX: '2' }).dbPoolMax).toBe(2);
    expect(() => loadConfig({ ...base, DB_POOL_MAX: '0' })).toThrow(/DB_POOL_MAX/);
    expect(() => loadConfig({ ...base, DB_POOL_MAX: 'many' })).toThrow(/DB_POOL_MAX/);
  });

  it('reads the port and log level, and turns off pretty logs in production', () => {
    const c = loadConfig({
      DATABASE_URL: 'postgres://localhost/db',
      API_PORT: '4100',
      LOG_LEVEL: 'warn',
      NODE_ENV: 'production',
    });
    expect(c).toMatchObject({ port: 4100, logLevel: 'warn', prettyLogs: false });
  });
});
