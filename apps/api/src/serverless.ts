import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { type AppConfig, loadConfig } from './config.js';

export interface Handler {
  listener: (req: IncomingMessage, res: ServerResponse) => void;
  close(): Promise<void>;
}

/** The app as a request listener, for platforms that call a handler instead of running `listen`. */
export async function createHandler(config: AppConfig): Promise<Handler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    bodyParser: false,
    bufferLogs: true,
  });
  configureApp(app);
  // Requests arrive through the platform's proxy; the client address is in X-Forwarded-For,
  // which the rate limiter needs to tell clients apart.
  app.set('trust proxy', true);
  await app.init();
  return { listener: app.getHttpAdapter().getInstance(), close: () => app.close() };
}

let handler: Promise<Handler> | undefined;

/** Vercel entry (`api/index.js`): one app per instance, built on the first request. */
export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  handler ??= createHandler(loadConfig(process.env)).catch((err: unknown) => {
    handler = undefined; // retry on the next request instead of failing forever
    throw err;
  });
  (await handler).listener(req, res);
}
