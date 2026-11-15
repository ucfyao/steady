import { Controller, Delete, HttpCode, Inject, Post } from '@nestjs/common';
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
  @Post('players')
  async create() {
    const token = newToken();
    await this.db.insert(players).values({ tokenHash: hashToken(token) });
    return { token };
  }

  /** Deletes the player; their sessions go with them (ON DELETE CASCADE). */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@PlayerId() playerId: string) {
    await this.db.delete(players).where(eq(players.id, playerId));
  }
}
