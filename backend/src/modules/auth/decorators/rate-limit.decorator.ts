import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
}

// Per docs/01-prd-mvp.md §10.1 business rule: 5 attempts / 15 minutes per
// identifier (IP + email when present) on login/register/forgot-password.
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
