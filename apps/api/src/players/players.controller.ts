import { randomInt } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreatePlayerSchema,
  UpdateMeSchema,
  VARIANTS,
  type Me,
  type PlayerListItem,
} from '@steady/core';
import { Throttle } from '@nestjs/throttler';
import { and, asc, count, eq, isNotNull } from 'drizzle-orm';
import { PlayerId } from '../auth/player-id.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { hashToken, newToken } from '../auth/token.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { players, sessions } from '../db/schema.js';
import type { z } from 'zod';

@Controller()
export class PlayersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** The token is returned once and never stored in plain text; the name is (Spec 013). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // [P]
  @Post('players')
  async create(
    @Body(new ZodValidationPipe(CreatePlayerSchema)) body: z.infer<typeof CreatePlayerSchema>,
  ) {
    const token = newToken();
    // [P] Spec 006 §5, Spec 008: a third each, kept for the player's whole history.
    // Spec 011 §3: the development tools may choose it; the app never does for a player.
    const variant = body.variant ?? VARIANTS[randomInt(VARIANTS.length)]!;
    await this.db
      .insert(players)
      .values({ tokenHash: hashToken(token), token, variant, name: body.name });
    return { token };
  }

  /**
   * Every player, oldest first, with their token (Spec 016): everyone sees every player and can
   * act as any of them. Players without a stored token (made before Spec 016) are left out.
   */
  @Public()
  @Get('players')
  async list(): Promise<PlayerListItem[]> {
    const rows = await this.db
      .select({
        id: players.id,
        name: players.name,
        variant: players.variant,
        token: players.token,
        createdAt: players.createdAt,
        completedSessions: count(sessions.id),
      })
      .from(players)
      .leftJoin(sessions, and(eq(sessions.playerId, players.id), isNotNull(sessions.completedAt)))
      .where(isNotNull(players.token))
      .groupBy(players.id)
      .orderBy(asc(players.createdAt), asc(players.id));
    return rows.map((r) => ({ ...r, token: r.token!, createdAt: r.createdAt.toISOString() }));
  }

  /** The player's name (Spec 013) and A/B variant (Spec 006), which practice already shows. */
  @Get('me')
  async me(@PlayerId() playerId: string): Promise<Me> {
    const [row] = await this.db
      .select({ name: players.name, variant: players.variant })
      .from(players)
      .where(eq(players.id, playerId));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Renames the player (Spec 013). The group never changes. */
  @Patch('me')
  async updateMe(
    @PlayerId() playerId: string,
    @Body(new ZodValidationPipe(UpdateMeSchema)) body: z.infer<typeof UpdateMeSchema>,
  ): Promise<Me> {
    const [row] = await this.db
      .update(players)
      .set({ name: body.name })
      .where(eq(players.id, playerId))
      .returning({ name: players.name, variant: players.variant });
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Deletes the player; their sessions go with them (ON DELETE CASCADE). */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@PlayerId() playerId: string) {
    await this.db.delete(players).where(eq(players.id, playerId));
  }
}
