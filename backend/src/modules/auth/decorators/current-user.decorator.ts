import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../auth.types';

// Populated by JwtAuthGuard/JwtAccessStrategy. Use only on routes guarded by
// JwtAuthGuard — elsewhere `request.user` is undefined.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);
