import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

/** Shared by main.ts and the integration tests, so tests exercise the real HTTP setup. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useBodyParser('json', { limit: '32kb' });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
