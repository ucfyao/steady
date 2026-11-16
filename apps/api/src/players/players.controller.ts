import { randomInt } from 'node:crypto';
import { Controller, Delete, Get, HttpCode, Inject, NotFoundException, Post } from '@nestjs/common';
import { VARIANTS } from '@steady/core';
import { Throttle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import { PlayerId } from '../auth/player-id.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { hashToken, newToken } from '../auth/token.js';
import { DB, type Db } from '../db/db.module.js';
import { players } from '../db/schema.js';

@Controller()
export class PlayersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** The token is returned once and never stored in plain text. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // [P]
  @Post('players')
  async create() {
    const token = newToken();
    // [P] Spec 006 §5: 50/50 between the variants, kept for the player's whole history.
    const variant = VARIANTS[randomInt(VARIANTS.length)]!;
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
