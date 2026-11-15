import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { StartSessionSchema } from '@steady/core';
import type { z } from 'zod';
import { PlayerId } from '../auth/player-id.decorator.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  start(
    @PlayerId() playerId: string,
    @Body(new ZodValidationPipe(StartSessionSchema)) body: z.infer<typeof StartSessionSchema>,
  ) {
    return this.sessions.start(playerId, body.checkIn ?? null, body.device);
  }

  /** The body is validated against this session's plan inside the service (Spec 001). */
  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @PlayerId() playerId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.sessions.submit(playerId, id, body);
  }

  @Get()
  list(@PlayerId() playerId: string) {
    return this.sessions.listCompleted(playerId);
  }
}
