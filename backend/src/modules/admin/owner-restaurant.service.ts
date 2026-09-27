import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  OwnerRestaurantDetailDto,
  OwnerRestaurantListItemDto,
  OwnerRestaurantStatsDto,
  PhotoDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../media/s3.service';
import { AdminRestaurantService } from './admin-restaurant.service';
import type { AttachPhotoDto } from './dto/attach-photo.dto';
import type { SetCoverPhotoDto } from './dto/set-cover-photo.dto';

// Owner-scoped surface over AdminRestaurantService — every method here is
// only ever reached through OwnerRestaurantController, which is guarded by
// OwnerRestaurantGuard on every route carrying a restaurant id, so the
// "does this user actually own this restaurant" check has already happened
// by the time these run. What OwnerRestaurantGuard does NOT verify is that
// a photoId in the URL belongs to that same restaurant (its route is keyed
// by restaurant id, not photo id) — removePhoto() below closes that gap.
@Injectable()
export class OwnerRestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly adminRestaurantService: AdminRestaurantService,
  ) {}

  async listMine(userId: string): Promise<OwnerRestaurantListItemDto[]> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, name: true, slug: true, coverPhotoId: true },
      orderBy: { name: 'asc' },
    });
    const coverPhotoIds = restaurants
      .map((r) => r.coverPhotoId)
      .filter((id): id is string => id !== null);
    const coverPhotos = coverPhotoIds.length
      ? await this.prisma.photo.findMany({
          where: { id: { in: coverPhotoIds } },
          select: { id: true, storageKey: true },
        })
      : [];
    const coverPhotoById = new Map(coverPhotos.map((p) => [p.id, p]));

    return restaurants.map((r) => {
      const storageKey = r.coverPhotoId ? coverPhotoById.get(r.coverPhotoId)?.storageKey : undefined;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        thumbnailUrl: storageKey ? this.s3.publicUrl(storageKey) : null,
      };
    });
  }

  async getDetail(restaurantId: string): Promise<OwnerRestaurantDetailDto> {
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      include: { address: true, location: true, openingHours: true, facilities: true },
    });
    const menu = await this.prisma.menu.findFirst({ where: { restaurantId } });
    const [restaurantPhotos, menuPhotos] = await Promise.all([
      this.prisma.photo.findMany({
        where: { ownerType: 'restaurant', ownerId: restaurantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      menu
        ? this.prisma.photo.findMany({
            where: { ownerType: 'menu', ownerId: menu.id, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      phone: restaurant.phone,
      address: {
        line: restaurant.address.line,
        ward: restaurant.address.ward,
        district: restaurant.address.district,
        province: restaurant.address.province,
      },
      location: { lat: Number(restaurant.location.lat), lng: Number(restaurant.location.lng) },
      // Narrowed to the same shape edit_suggestion's 'openingHours' payload
      // requires (see OwnerRestaurantDetailDto's doc comment) — a day with
      // isOpen24h or a second time range displays as its first range only.
      openingHours: restaurant.openingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime?.toISOString().slice(11, 16),
        closeTime: h.closeTime?.toISOString().slice(11, 16),
        isClosed: h.isClosed,
      })),
      facilities: restaurant.facilities.map((f) => f.facilityCode),
      facebookUrl: restaurant.facebookUrl,
      instagramUrl: restaurant.instagramUrl,
      tiktokUrl: restaurant.tiktokUrl,
      websiteUrl: restaurant.websiteUrl,
      photos: restaurantPhotos.map((p) => ({ id: p.id, url: this.s3.publicUrl(p.storageKey), width: p.width, height: p.height })),
      coverPhotoId: restaurant.coverPhotoId,
      menuPhotos: menuPhotos.map((p) => ({ id: p.id, url: this.s3.publicUrl(p.storageKey), width: p.width, height: p.height })),
    };
  }

  async getStats(restaurantId: string): Promise<OwnerRestaurantStatsDto> {
    const status = await this.prisma.restaurantStatus.findUnique({
      where: { restaurantId },
    });
    return {
      viewCount: status?.viewCount ?? 0,
      reviewCount: status?.reviewCount ?? 0,
      compositeScore: status?.compositeScore ? Number(status.compositeScore) : null,
      lastReviewAt: status?.lastReviewAt?.toISOString() ?? null,
      lastComputedAt: status?.lastComputedAt?.toISOString() ?? null,
    };
  }

  attachPhoto(restaurantId: string, dto: AttachPhotoDto, actorId: string): Promise<PhotoDto> {
    return this.adminRestaurantService.attachPhoto(restaurantId, dto, actorId);
  }

  attachMenuPhoto(restaurantId: string, dto: AttachPhotoDto, actorId: string): Promise<PhotoDto> {
    return this.adminRestaurantService.attachMenuPhoto(restaurantId, dto, actorId);
  }

  setCoverPhoto(restaurantId: string, dto: SetCoverPhotoDto, actorId: string): Promise<void> {
    return this.adminRestaurantService.setCoverPhoto(restaurantId, dto.photoId, actorId);
  }

  async removePhoto(restaurantId: string, photoId: string, actorId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
      select: { ownerType: true, ownerId: true },
    });
    if (!photo) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
    const belongsToRestaurant =
      (photo.ownerType === 'restaurant' && photo.ownerId === restaurantId) ||
      (photo.ownerType === 'menu' &&
        (await this.prisma.menu.findFirst({
          where: { id: photo.ownerId ?? undefined, restaurantId },
          select: { id: true },
        })) !== null);
    if (!belongsToRestaurant) {
      throw new ForbiddenException('Ảnh này không thuộc về quán của bạn');
    }
    await this.adminRestaurantService.removePhoto(photoId, actorId);
  }
}
