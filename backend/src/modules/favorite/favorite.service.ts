import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FavoriteListResponse,
  FavoriteStatusDto,
  PriceRangeCode,
  RestaurantCategoryCode,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../media/s3.service';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class FavoriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // Idempotent per docs/build-prompts/08's spec: favoriting an
  // already-favorited restaurant just succeeds, it never errors.
  async add(userId: string, restaurantId: string): Promise<FavoriteStatusDto> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    await this.prisma.favorite.upsert({
      where: { userId_restaurantId: { userId, restaurantId } },
      update: {},
      create: { userId, restaurantId },
    });
    return { restaurantId, isFavorited: true };
  }

  // Idempotent the other direction too — un-favoriting something that isn't
  // favorited just reflects the (already-true) end state, no error.
  async remove(userId: string, restaurantId: string): Promise<FavoriteStatusDto> {
    await this.prisma.favorite.deleteMany({ where: { userId, restaurantId } });
    return { restaurantId, isFavorited: false };
  }

  async list(userId: string, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE): Promise<FavoriteListResponse> {
    const where = { userId, restaurant: { deletedAt: null } };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        include: {
          restaurant: { include: { category: true, priceRange: true, address: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.favorite.count({ where }),
    ]);

    const restaurantIds = rows.map((r) => r.restaurantId);
    const photos =
      restaurantIds.length > 0
        ? await this.prisma.photo.findMany({
            where: { ownerType: 'restaurant', ownerId: { in: restaurantIds }, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          })
        : [];
    const firstPhotoByRestaurant = new Map<string, string>();
    for (const photo of photos) {
      // ownerId is nullable at the schema level (build-prompts/07) but this
      // query always filters by ownerId IN (restaurant ids), so it's never
      // null here.
      if (photo.ownerId && !firstPhotoByRestaurant.has(photo.ownerId)) {
        firstPhotoByRestaurant.set(photo.ownerId, this.s3.publicUrl(photo.storageKey));
      }
    }

    return {
      items: rows.map((f) => ({
        id: f.id,
        restaurantId: f.restaurantId,
        createdAt: f.createdAt.toISOString(),
        restaurant: {
          id: f.restaurant.id,
          name: f.restaurant.name,
          categoryCode: f.restaurant.category.code as RestaurantCategoryCode,
          thumbnailUrl: firstPhotoByRestaurant.get(f.restaurantId) ?? null,
          compositeScore: f.restaurant.status?.compositeScore ? Number(f.restaurant.status.compositeScore) : null,
          reviewCount: f.restaurant.status?.reviewCount ?? 0,
          priceRange: f.restaurant.priceRange
            ? {
                code: f.restaurant.priceRange.code as PriceRangeCode,
                minVnd: f.restaurant.priceRange.minVnd,
                maxVnd: f.restaurant.priceRange.maxVnd,
              }
            : null,
          district: f.restaurant.address.district,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, restaurant: { deletedAt: null } },
      select: { restaurantId: true },
    });
    return rows.map((r) => r.restaurantId);
  }
}
