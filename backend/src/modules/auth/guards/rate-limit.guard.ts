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
import type { RequestUser } from '../auth.types';
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
    // Authenticated endpoints (e.g. review submission) rate-limit per user,
    // not per IP — an IP-only key would collectively throttle every user
    // behind the same NAT/office network (and every automated test run from
    // the same test-runner IP), which is both wrong for real users sharing
    // a network and breaks test suites that legitimately create many
    // reviews across many distinct registered users in one run. Pre-auth
    // endpoints (login/register/forgot-password) have no `request.user`
    // yet (set by JwtAuthGuard, which must run before this guard), so they
    // keep the original IP(+email) identifier.
    const authenticatedUser = (request as unknown as { user?: RequestUser })
      .user;
    if (authenticatedUser?.id) {
      return `user:${authenticatedUser.id}`;
    }
    const ip = request.ip ?? 'unknown';
    const email =
      typeof (request.body as { email?: unknown } | undefined)?.email ===
      'string'
        ? (request.body as { email: string }).email.toLowerCase()
        : undefined;
    return email ? `${ip}:${email}` : ip;
  }
}
