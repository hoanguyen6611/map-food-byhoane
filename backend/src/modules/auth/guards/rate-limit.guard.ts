import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RedisService } from '../../../redis/redis.service';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

// Sliding-window rate limiter backed by a Redis sorted set (the "sliding log"
// algorithm): each attempt is a member scored by its timestamp; on each
// check we drop members older than the window, then count what's left.
// More accurate than a fixed-window counter for a security control like this.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const identifier = this.buildIdentifier(request);
    const key = `ratelimit:${options.keyPrefix}:${identifier}`;
    const client = this.redis.getClient();
    const now = Date.now();
    const windowStart = now - options.windowSeconds * 1000;

    await client.zremrangebyscore(key, 0, windowStart);
    const count = await client.zcard(key);

    if (count >= options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'TooManyRequests',
          message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${Math.ceil(options.windowSeconds / 60)} phút.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await client.zadd(key, now, `${now}-${Math.random()}`);
    await client.expire(key, options.windowSeconds);
    return true;
  }

  private buildIdentifier(request: Request): string {
    const ip = request.ip ?? 'unknown';
    const email =
      typeof (request.body as { email?: unknown } | undefined)?.email ===
      'string'
        ? (request.body as { email: string }).email.toLowerCase()
        : undefined;
    return email ? `${ip}:${email}` : ip;
  }
}
