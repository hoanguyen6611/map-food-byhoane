import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CollectionDetailDto,
  CollectionListResponse,
  CollectionSummaryDto,
  PriceRangeCode,
  RestaurantCategoryCode,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async create(userId: string, name: string, description?: string): Promise<CollectionSummaryDto> {
    const collection = await this.prisma.collection.create({
      data: { userId, name, description },
    });
    return this.toSummaryDto(collection, 0);
  }

  async listMine(userId: string): Promise<CollectionListResponse> {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: collections.map((c) => this.toSummaryDto(c, c._count.items)),
    };
  }

  /**
   * `viewerId` undefined for a logged-out visitor. A private collection
   * 404s for anyone but its owner — "private" and "doesn't exist" treated
   * identically, same convention as UserPublicService.getProfile.
   */
  async getDetail(id: string, viewerId: string | undefined): Promise<CollectionDetailDto> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            restaurant: {
              include: { category: true, priceRange: true, address: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const isOwner = collection?.userId === viewerId;
    if (!collection || (!collection.isPublic && !isOwner)) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }

    const restaurantIds = collection.items.map((i) => i.restaurantId);
    const photos = restaurantIds.length
      ? await this.prisma.photo.findMany({
          where: { ownerType: 'restaurant', ownerId: { in: restaurantIds }, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const thumbnailByRestaurantId = new Map<string, string>();
    for (const photo of photos) {
      if (photo.ownerId && !thumbnailByRestaurantId.has(photo.ownerId)) {
        thumbnailByRestaurantId.set(photo.ownerId, this.mediaService.resolveUrl(photo.storageKey));
      }
    }

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      isOwner,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      items: collection.items
        .filter((item) => item.restaurant.deletedAt === null)
        .map((item) => ({
          addedAt: item.createdAt.toISOString(),
          restaurant: {
            id: item.restaurant.id,
            slug: item.restaurant.slug,
            name: item.restaurant.name,
            categoryCode: item.restaurant.category.code as RestaurantCategoryCode,
            thumbnailUrl: thumbnailByRestaurantId.get(item.restaurantId) ?? null,
            compositeScore: item.restaurant.status?.compositeScore ? Number(item.restaurant.status.compositeScore) : null,
            reviewCount: item.restaurant.status?.reviewCount ?? 0,
            priceRange: item.restaurant.priceRange
              ? {
                  code: item.restaurant.priceRange.code as PriceRangeCode,
                  minVnd: item.restaurant.priceRange.minVnd,
                  maxVnd: item.restaurant.priceRange.maxVnd,
                }
              : null,
            district: item.restaurant.address.district,
          },
        })),
    };
  }

  async update(
    id: string,
    userId: string,
    patch: { name?: string; description?: string; isPublic?: boolean },
  ): Promise<CollectionSummaryDto> {
    const collection = await this.assertOwner(id, userId);
    const updated = await this.prisma.collection.update({
      where: { id: collection.id },
      data: patch,
      include: { _count: { select: { items: true } } },
    });
    return this.toSummaryDto(updated, updated._count.items);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOwner(id, userId);
    await this.prisma.collection.delete({ where: { id } });
  }

  async addItem(id: string, userId: string, restaurantId: string): Promise<void> {
    await this.assertOwner(id, userId);
    const restaurant = await this.prisma.restaurant.findFirst({ where: { id: restaurantId, deletedAt: null } });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    // Idempotent — adding an already-present restaurant just succeeds,
    // same convention as FavoriteService.add.
    await this.prisma.collectionItem.upsert({
      where: { collectionId_restaurantId: { collectionId: id, restaurantId } },
      update: {},
      create: { collectionId: id, restaurantId },
    });
  }

  async removeItem(id: string, userId: string, restaurantId: string): Promise<void> {
    await this.assertOwner(id, userId);
    await this.prisma.collectionItem.deleteMany({ where: { collectionId: id, restaurantId } });
  }

  private async assertOwner(id: string, userId: string): Promise<{ id: string; userId: string }> {
    const collection = await this.prisma.collection.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!collection) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }
    if (collection.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bộ sưu tập này');
    }
    return collection;
  }

  private toSummaryDto(
    collection: { id: string; name: string; description: string | null; isPublic: boolean; createdAt: Date; updatedAt: Date },
    itemCount: number,
  ): CollectionSummaryDto {
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      itemCount,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    };
  }
}
