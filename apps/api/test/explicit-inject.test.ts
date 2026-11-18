import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PlayerGuard } from '../src/auth/player.guard.js';
import { HealthController } from '../src/health/health.controller.js';
import { PlayersController } from '../src/players/players.controller.js';
import { ProgressController } from '../src/progress/progress.controller.js';
import { SessionsController } from '../src/sessions/sessions.controller.js';
import { SessionsService } from '../src/sessions/sessions.service.js';

// Name every constructor dependency with @Inject(), so the API does not depend on
// the compiler emitting decorator metadata. tsc emits it; tsx and esbuild (used by
// Vercel's NestJS preset, among others) do not, and Nest then injects undefined.
const injectables = {
  PlayerGuard,
  HealthController,
  PlayersController,
  ProgressController,
  SessionsController,
  SessionsService,
};

describe('dependency injection without decorator metadata', () => {
  it.each(Object.entries(injectables))('%s names every constructor dependency', (_, cls) => {
    const named: unknown[] = Reflect.getMetadata('self:paramtypes', cls) ?? [];
    expect(named).toHaveLength(cls.length);
  });
});
