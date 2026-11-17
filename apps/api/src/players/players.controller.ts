import { randomInt } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { CreatePlayerSchema, VARIANTS } from '@steady/core';
import { Throttle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import { PlayerId } from '../auth/player-id.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { hashToken, newToken } from '../auth/token.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { players } from '../db/schema.js';
import type { z } from 'zod';

@Controller()
export class PlayersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The token is returned once and never stored in plain text. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // [P]
  @Post('players')
  async create(
    @Body(new ZodValidationPipe(CreatePlayerSchema)) body: z.infer<typeof CreatePlayerSchema>,
  ) {
    // Spec 011 §3: choosing the group is a development tool; players never pick their own.
    if (body.variant && !this.config.devTools)
      throw new ForbiddenException('A variant can only be chosen with the development tools on.');
    const token = newToken();
    // [P] Spec 006 §5, Spec 008: a third each, kept for the player's whole history.
    const variant = body.variant ?? VARIANTS[randomInt(VARIANTS.length)]!;
    await this.db.insert(players).values({ tokenHash: hashToken(token), variant });
    return { token };
  }

  /** The player's A/B variant (Spec 006), so the practice round can already show it. */
  @Get('me')
  async me(@PlayerId() playerId: string) {
    const [row] = await this.db
      .select({ variant: players.variant })
      .from(players)
      .where(eq(players.id, playerId));
    if (!row) throw new NotFoundException();
    return { variant: row.variant };
  }

  /** Deletes the player; their sessions go with them (ON DELETE CASCADE). */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@PlayerId() playerId: string) {
    await this.db.delete(players).where(eq(players.id, playerId));
  }
}
