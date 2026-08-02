import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsService } from '../permissions.service';
import type { RequestUser } from '../auth.types';

// Must run after JwtAuthGuard. Fine-grained companion to RolesGuard — see
// docs/build-prompts/02-auth.md: "Enforce RolePermission lookups, cached
// in-memory... to avoid a DB hit per permission check."
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string[] | undefined>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này',
      );
    }

    const granted = await Promise.all(
      required.map((code) => this.permissions.hasPermission(user.roleId, code)),
    );
    if (!granted.every(Boolean)) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này',
      );
    }
    return true;
  }
}
