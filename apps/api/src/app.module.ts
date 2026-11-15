import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';

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
      ],
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
