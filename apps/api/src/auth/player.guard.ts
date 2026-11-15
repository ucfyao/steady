import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DB, type Db } from '../db/db.module.js';
import { players } from '../db/schema.js';
import { IS_PUBLIC } from './public.decorator.js';
import { hashToken, tokenFromHeader } from './token.js';

export interface PlayerRequest extends Request {
  playerId?: string;
}

/**
 * Global guard: every route needs a valid token unless marked @Public().
 * The player id comes only from the token, never from the URL or body.
 */
@Injectable()
export class PlayerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<PlayerRequest>();
    const token = tokenFromHeader(req.headers.authorization);
    if (!token) throw new UnauthorizedException();

    const [player] = await this.db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.tokenHash, hashToken(token)));
    if (!player) throw new UnauthorizedException();

    req.playerId = player.id;
    return true;
  }
}
