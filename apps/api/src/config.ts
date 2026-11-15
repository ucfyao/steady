import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export interface AppConfig {
  databaseUrl: string;
  port: number;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  prettyLogs: boolean;
  /** Requests per minute per client; `false` turns rate limiting off (tests only). */
  rateLimitPerMinute: number | false;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Fails fast with a readable message instead of starting with bad config. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}\nSee .env.example.`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.API_PORT,
    logLevel: e.LOG_LEVEL,
    prettyLogs: e.NODE_ENV === 'development',
    rateLimitPerMinute: 120, // [P]
  };
}
