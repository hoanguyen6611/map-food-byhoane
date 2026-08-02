import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@foodmap/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);
    return { status: db && redis ? 'ok' : 'degraded', db, redis };
  }
}
