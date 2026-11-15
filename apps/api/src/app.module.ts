import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { PlayerGuard } from './auth/player.guard.js';
import { CLOCK, systemClock } from './clock.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { PlayersModule } from './players/players.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { SessionsModule } from './sessions/sessions.module.js';

/**
 * Built from an explicit config (not process.env) so tests can run the real
 * app against a Testcontainers database.
 */
@Module({})
export class AppModule {
  /** `logDestination` lets tests read the request logs; production logs go to stdout. */
  static register(config: AppConfig, logDestination?: DestinationStream): DynamicModule {
    // Guards run in order: rate limit first (cheap, no DB), then the token check.
    const guards: Provider[] = [];
    if (config.rateLimitPerMinute !== false)
      guards.push({ provide: APP_GUARD, useClass: ThrottlerGuard });
    guards.push({ provide: APP_GUARD, useClass: PlayerGuard });

    const logOptions = {
      level: config.logLevel,
      redact: ['req.headers.authorization'],
      ...(config.prettyLogs ? { transport: { target: 'pino-pretty' } } : {}),
    };

    return {
      module: AppModule,
      global: true,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: logDestination ? [logOptions, logDestination] : logOptions,
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.rateLimitPerMinute || 1 }]),
        DbModule,
        PlayersModule,
        SessionsModule,
        ProgressModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: CLOCK, useValue: systemClock },
        ...guards,
      ],
      exports: [APP_CONFIG, CLOCK],
    };
  }
}
