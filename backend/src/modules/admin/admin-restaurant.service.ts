import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminRestaurantDetailDto,
  AdminRestaurantListItemDto,
  CuisineCode,
  MenuItemDto,
  Paginated,
  PhotoDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { slugify } from '../../common/slug.util';
import { AuditLogService } from './audit-log.service';
import { PhotoService } from './photo.service';
import type { CreateRestaurantDto } from './dto/create-restaurant.dto';
import type { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import type { AdminRestaurantQueryDto } from './dto/admin-restaurant-query.dto';
import type { ReplaceOpeningHoursDto } from './dto/opening-hours.dto';
import type { ReplaceFacilitiesDto } from './dto/facilities.dto';
import type { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import type { AttachPhotoDto } from './dto/attach-photo.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class AdminRestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantService: RestaurantService,
    private readonly auditLog: AuditLogService,
    private readonly photoService: PhotoService,
  ) {}

  async list(query: AdminRestaurantQueryDto): Promise<Paginated<AdminRestaurantListItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where = {
      ...(query.status ? { status: { publicationStatus: query.status } } : {}),
      ...(query.province ? { address: { province: { contains: query.province, mode: 'insensitive' as const } } } : {}),
      ...(query.district ? { address: { district: { contains: query.district, mode: 'insensitive' as const } } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.restaurant.findMany({
        where,
        include: { category: true, address: true, status: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    const items: AdminRestaurantListItemDto[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoryCode: r.category.code as AdminRestaurantListItemDto['categoryCode'],
      province: r.address.province,
      district: r.address.district,
      publicationStatus: r.status?.publicationStatus ?? 'pending',
      createdAt: r.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  async getDetail(id: string): Promise<AdminRestaurantDetailDto> {
    const restaurant = await this.restaurantService.findForAdminDetail(id, true);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    const detail = await this.restaurantService.buildDetailDto(restaurant);
    return {
      ...detail,
      publicationStatus: restaurant.status?.publicationStatus ?? 'pending',
      createdAt: restaurant.createdAt.toISOString(),
      updatedAt: restaurant.updatedAt.toISOString(),
      deletedAt: restaurant.deletedAt?.toISOString() ?? null,
    };
  }

  async create(dto: CreateRestaurantDto, actorId: string): Promise<AdminRestaurantDetailDto> {
    const category = await this.prisma.restaurantCategory.findUniqueOrThrow({
      where: { code: dto.categoryCode },
    });
    const priceRange = dto.priceRangeCode
      ? await this.prisma.priceRange.findUniqueOrThrow({ where: { code: dto.priceRangeCode } })
      : null;

    const slug = await this.generateUniqueSlug(dto.name);

    // Address/Location created standalone first — same reason as
    // prisma/seed-test-restaurants.ts: Restaurant's other FKs (categoryId,
    // priceRangeId) are assigned as raw scalars, which can't be mixed with a
    // nested relation `create` in one Prisma call.
    const address = await this.prisma.address.create({
      data: {
        line: dto.address.line,
        ward: dto.address.ward,
        district: dto.address.district,
        province: dto.address.province,
        fullAddressText: [dto.address.line, dto.address.ward, dto.address.district, dto.address.province]
          .filter(Boolean)
          .join(', '),
      },
    });
    const location = await this.prisma.location.create({
      data: { lat: dto.location.lat, lng: dto.location.lng },
    });

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        categoryId: category.id,
        priceRangeId: priceRange?.id,
        phone: dto.phone,
        addressId: address.id,
        locationId: location.id,
        submittedBy: actorId,
      },
    });

    // Admin-created content is trusted — published immediately, no
    // moderation queue (that's build-prompts/07's community-contribution flow).
    await this.prisma.restaurantStatus.create({
      data: { restaurantId: restaurant.id, publicationStatus: 'published' },
    });

    if (dto.cuisineCodes && dto.cuisineCodes.length > 0) {
      await this.setCuisines(restaurant.id, dto.cuisineCodes);
    }

    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({
      actorId,
      action: 'restaurant.create',
      targetType: 'restaurant',
      targetId: restaurant.id,
      afterState: { name: dto.name, slug, categoryCode: dto.categoryCode },
    });

    return this.getDetail(restaurant.id);
  }

  async update(id: string, dto: UpdateRestaurantDto, actorId: string): Promise<AdminRestaurantDetailDto> {
    const before = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id },
      include: { address: true, location: true },
    });

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.categoryCode !== undefined) {
      const category = await this.prisma.restaurantCategory.findUniqueOrThrow({
        where: { code: dto.categoryCode },
      });
      data.categoryId = category.id;
    }
    if (dto.priceRangeCode !== undefined) {
      const priceRange = await this.prisma.priceRange.findUniqueOrThrow({
        where: { code: dto.priceRangeCode },
      });
      data.priceRangeId = priceRange.id;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.restaurant.update({ where: { id }, data });
    }

    if (dto.address) {
      await this.prisma.address.update({
        where: { id: before.addressId },
        data: {
          line: dto.address.line,
          ward: dto.address.ward,
          district: dto.address.district,
          province: dto.address.province,
          fullAddressText: [dto.address.line, dto.address.ward, dto.address.district, dto.address.province]
            .filter(Boolean)
            .join(', '),
        },
      });
    }

    if (dto.location) {
      // Updating lat/lng re-fires the geo_point sync trigger (see
      // migration.sql from build-prompts/01) — no extra code needed here.
      await this.prisma.location.update({
        where: { id: before.locationId },
        data: { lat: dto.location.lat, lng: dto.location.lng },
      });
    }

    if (dto.cuisineCodes !== undefined) {
      await this.setCuisines(id, dto.cuisineCodes);
    }

    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({
      actorId,
      action: 'restaurant.update',
      targetType: 'restaurant',
      targetId: id,
      beforeState: { name: before.name, phone: before.phone, description: before.description },
      afterState: dto,
    });

    return this.getDetail(id);
  }

  async hide(id: string, actorId: string): Promise<void> {
    await this.prisma.restaurantStatus.update({
      where: { restaurantId: id },
      data: { publicationStatus: 'hidden' },
    });
    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({ actorId, action: 'restaurant.hide', targetType: 'restaurant', targetId: id });
  }

  async restore(id: string, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.restaurant.update({ where: { id }, data: { deletedAt: null } }),
      this.prisma.restaurantStatus.update({ where: { restaurantId: id }, data: { publicationStatus: 'published' } }),
    ]);
    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({ actorId, action: 'restaurant.restore', targetType: 'restaurant', targetId: id });
  }

  // Admin-only per docs/01-prd-mvp.md §10.11 business rule — RolesGuard on
  // the controller enforces `moderator` can never reach this method.
  async remove(id: string, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.restaurant.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.restaurantStatus.update({ where: { restaurantId: id }, data: { publicationStatus: 'removed' } }),
    ]);
    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({ actorId, action: 'restaurant.delete', targetType: 'restaurant', targetId: id });
  }

  async replaceOpeningHours(id: string, dto: ReplaceOpeningHoursDto, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.openingHour.deleteMany({ where: { restaurantId: id } }),
      this.prisma.openingHour.createMany({
        data: dto.days.map((day) => ({
          restaurantId: id,
          dayOfWeek: day.dayOfWeek,
          openTime: day.isClosed || !day.openTime ? null : this.parseTime(day.openTime),
          closeTime: day.isClosed || !day.closeTime ? null : this.parseTime(day.closeTime),
          isClosed: day.isClosed,
        })),
      }),
    ]);
    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({
      actorId,
      action: 'restaurant.opening_hours.replace',
      targetType: 'restaurant',
      targetId: id,
      afterState: dto,
    });
  }

  async replaceFacilities(id: string, dto: ReplaceFacilitiesDto, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.restaurantFacility.deleteMany({ where: { restaurantId: id } }),
      ...(dto.facilities.length > 0
        ? [
            this.prisma.restaurantFacility.createMany({
              data: dto.facilities.map((facilityType) => ({ restaurantId: id, facilityType })),
            }),
          ]
        : []),
    ]);
    await this.restaurantService.invalidateViewportCache();
    await this.auditLog.record({
      actorId,
      action: 'restaurant.facilities.replace',
      targetType: 'restaurant',
      targetId: id,
      afterState: dto,
    });
  }

  async addMenuItem(restaurantId: string, dto: CreateMenuItemDto, actorId: string): Promise<MenuItemDto> {
    let menu = await this.prisma.menu.findFirst({ where: { restaurantId } });
    if (!menu) {
      menu = await this.prisma.menu.create({ data: { restaurantId, isActive: true } });
    }
    const item = await this.prisma.menuItem.create({
      data: {
        menuId: menu.id,
        name: dto.name,
        priceVnd: dto.priceVnd,
        category: dto.category,
        isPopular: dto.isPopular ?? false,
      },
    });
    await this.auditLog.record({
      actorId,
      action: 'restaurant.menu_item.create',
      targetType: 'restaurant',
      targetId: restaurantId,
      afterState: dto,
    });
    return { id: item.id, name: item.name, priceVnd: item.priceVnd, category: item.category, isPopular: item.isPopular };
  }

  async updateMenuItem(itemId: string, dto: UpdateMenuItemDto, actorId: string): Promise<MenuItemDto> {
    const before = await this.prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    const item = await this.prisma.menuItem.update({ where: { id: itemId }, data: dto });
    await this.auditLog.record({
      actorId,
      action: 'restaurant.menu_item.update',
      targetType: 'menu_item',
      targetId: itemId,
      beforeState: before,
      afterState: dto,
    });
    return { id: item.id, name: item.name, priceVnd: item.priceVnd, category: item.category, isPopular: item.isPopular };
  }

  async removeMenuItem(itemId: string, actorId: string): Promise<void> {
    await this.prisma.menuItem.delete({ where: { id: itemId } });
    await this.auditLog.record({
      actorId,
      action: 'restaurant.menu_item.delete',
      targetType: 'menu_item',
      targetId: itemId,
    });
  }

  async attachPhoto(restaurantId: string, dto: AttachPhotoDto, actorId: string): Promise<PhotoDto> {
    const photo = await this.photoService.attach({
      ownerType: 'restaurant',
      ownerId: restaurantId,
      url: dto.url,
      width: dto.width,
      height: dto.height,
      uploadedBy: actorId,
    });
    await this.auditLog.record({
      actorId,
      action: 'restaurant.photo.attach',
      targetType: 'restaurant',
      targetId: restaurantId,
      afterState: { photoId: photo.id, url: dto.url },
    });
    return { id: photo.id, url: photo.storageKey, width: photo.width, height: photo.height };
  }

  async removePhoto(photoId: string, actorId: string): Promise<void> {
    await this.photoService.remove(photoId);
    await this.auditLog.record({
      actorId,
      action: 'restaurant.photo.remove',
      targetType: 'photo',
      targetId: photoId,
    });
  }

  private async setCuisines(restaurantId: string, cuisineCodes: CuisineCode[]): Promise<void> {
    const cuisines = await this.prisma.cuisine.findMany({ where: { code: { in: cuisineCodes } } });
    await this.prisma.$transaction([
      this.prisma.restaurantCuisine.deleteMany({ where: { restaurantId } }),
      ...(cuisines.length > 0
        ? [
            this.prisma.restaurantCuisine.createMany({
              data: cuisines.map((c) => ({ restaurantId, cuisineId: c.id })),
            }),
          ]
        : []),
    ]);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.restaurant.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private parseTime(hhmm: string): Date {
    const [hour, minute] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, hour, minute));
  }
}
