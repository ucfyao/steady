import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
  bodyParser: false,
  bufferLogs: true,
});
configureApp(app);
await app.listen(config.port);
