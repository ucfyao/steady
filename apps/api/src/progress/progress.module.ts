import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module.js';
import { ProgressController } from './progress.controller.js';

@Module({ imports: [SessionsModule], controllers: [ProgressController] })
export class ProgressModule {}
