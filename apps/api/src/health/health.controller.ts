import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/public.decorator.js';
import { DB, type Db } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}
