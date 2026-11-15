import { Controller, Get } from '@nestjs/common';
import {
  compareByCheckIn,
  comparePreProbe,
  summariseProgress,
  type ProgressMetric,
  type ProgressResponse,
  type ProgressSession,
} from '@steady/core';
import { PlayerId } from '../auth/player-id.decorator.js';
import { SessionsService } from '../sessions/sessions.service.js';

const METRICS: ProgressMetric[] = ['commissionRate', 'omissionRate', 'medianGoRtMs', 'rtCv'];

/** All statistics come from @steady/core (Spec 002); this only loads the player's sessions. */
@Controller('progress')
export class ProgressController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  async get(@PlayerId() playerId: string): Promise<ProgressResponse> {
    const history: ProgressSession[] = (await this.sessions.listCompleted(playerId)).map((s) => ({
      score: s.score,
      checkIn: s.checkIn,
    }));
    const byMetric = (dimension: 'sleep' | 'stress') =>
      Object.fromEntries(
        METRICS.map((m) => [m, compareByCheckIn(history, dimension, m)]),
      ) as ProgressResponse['checkIn']['sleep'];

    return {
      summary: summariseProgress(history),
      checkIn: { sleep: byMetric('sleep'), stress: byMetric('stress') },
      preProbe: comparePreProbe(history),
    };
  }
}
