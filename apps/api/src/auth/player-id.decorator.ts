import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PlayerRequest } from './player.guard.js';

/** The authenticated player's id, set by PlayerGuard. */
export const PlayerId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest<PlayerRequest>().playerId;
  if (!id) throw new Error('PlayerId used on a route without PlayerGuard');
  return id;
});
