import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { OWNED_RESTAURANT_PARAM_KEY } from '../decorators/owned-restaurant-param.decorator';
import type { RequestUser } from '../auth.types';

// Must run after JwtAuthGuard (relies on request.user being populated).
//
// Deliberately owner-only, not a shared "staff-or-owner" gate: staff keep
// using RolesGuard/@Roles('admin','moderator') on the existing
// AdminRestaurantController unchanged. This guard exists purely to scope an
// `owner`-role user to the restaurant(s) they actually own — RolesGuard has
// no per-resource concept at all, so an owner hitting a route guarded only
// by @Roles('owner') could otherwise act on ANY restaurant.
@Injectable()
export class OwnerRestaurantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: RequestUser; params: Record<string, string> }>();
    const user = request.user;
    if (!user || user.role !== 'owner') {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    const paramName =
      this.reflector.getAllAndOverride<string | undefined>(
        OWNED_RESTAURANT_PARAM_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'id';
    const restaurantId = request.params[paramName];

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    if (restaurant.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không phải chủ quán của quán này');
    }
    return true;
  }
}
