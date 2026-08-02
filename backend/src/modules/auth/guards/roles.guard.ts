import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@foodmap/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../auth.types';

// Must run after JwtAuthGuard (relies on request.user being populated).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride, not get(handler): a method-level @Roles(...) must
    // win over a class-level default (see AdminRestaurantController, whose
    // `remove()` overrides the class's @Roles('admin','moderator') down to
    // 'admin'-only) — plain `get(handler)` ignores class-level metadata
    // entirely, silently leaving every non-overridden method unguarded.
    const requiredRoles = this.reflector.getAllAndOverride<
      RoleCode[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này',
      );
    }
    return true;
  }
}
