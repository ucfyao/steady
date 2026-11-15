import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PlayerGuard } from './auth/player.guard.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { PlayersModule } from './players/players.module.js';

/**
 * Built from an explicit config (not process.env) so tests can run the real
 * app against a Testcontainers database.
 */
@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.logLevel,
            redact: ['req.headers.authorization'],
            ...(config.prettyLogs ? { transport: { target: 'pino-pretty' } } : {}),
          },
        }),
        DbModule,
        PlayersModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: PlayerGuard },
      ],
      exports: [APP_CONFIG],
    };
  }
}
