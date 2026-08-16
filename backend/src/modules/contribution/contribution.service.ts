import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ContributionListResponse,
  ContributionStatus,
  CreateEditSuggestionResponse,
  CreateRestaurantContributionResponse,
  CreateStatusReportResponse,
  DuplicateCandidateDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { MediaService } from '../media/media.service';
import { ContributionModerationService } from '../moderation/contribution-moderation.service';
import { ContributionFinalizeService } from './contribution-finalize.service';
import { slugify } from '../../common/slug.util';
import type { CreateRestaurantContributionDto } from './dto/create-restaurant-contribution.dto';
import type { CreateEditSuggestionDto } from './dto/edit-suggestion.dto';
import type { CreateStatusReportDto } from './dto/status-report.dto';

const DUPLICATE_RADIUS_METERS = 50;
// Stricter than search's 0.2 similarity threshold — this is a
// false-positive-sensitive UX warning, not a recall-maximizing search.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.4;
const CLOSURE_ESCALATION_WINDOW_DAYS = 14;
const CLOSURE_ESCALATION_REPORTER_COUNT = 3;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

interface DuplicateCandidateRow {
  id: string;
  name: string;
  full_address_text: string;
  distance_meters: number;
  similarity: number;
}

@Injectable()
export class ContributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantService: RestaurantService,
    private readonly mediaService: MediaService,
    private readonly moderationService: ContributionModerationService,
    private readonly finalizeService: ContributionFinalizeService,
  ) {}

  async checkDuplicate(lat: number, lng: number, name: string): Promise<DuplicateCandidateDto[]> {
    const rows = await this.prisma.$queryRaw<DuplicateCandidateRow[]>`
      SELECT
        r.id,
        r.name,
        a.full_address_text,
        ST_Distance(l.geo_point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance_meters,
        similarity(immutable_unaccent(r.name), immutable_unaccent(${name})) AS similarity
      FROM restaurants r
      JOIN locations l ON l.id = r.location_id
      JOIN addresses a ON a.id = r.address_id
      WHERE r.deleted_at IS NULL
        AND ST_DWithin(l.geo_point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${DUPLICATE_RADIUS_METERS})
        AND similarity(immutable_unaccent(r.name), immutable_unaccent(${name})) > ${DUPLICATE_SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      fullAddressText: row.full_address_text,
      distanceMeters: Math.round(row.distance_meters),
      similarity: Number(row.similarity.toFixed(2)),
    }));
  }

  async createNewRestaurant(dto: CreateRestaurantContributionDto, userId: string): Promise<CreateRestaurantContributionResponse> {
    if (!dto.duplicateConfirmed) {
      const candidates = await this.checkDuplicate(dto.location.lat, dto.location.lng, dto.name);
      if (candidates.length > 0) {
        throw new ConflictException({
          message: 'Có thể quán này đã tồn tại — xác nhận nếu đây là quán khác.',
          candidates,
        });
      }
    }

    const category = await this.prisma.restaurantCategory.findUniqueOrThrow({ where: { code: dto.categoryCode } });
    const priceRange = dto.priceRangeCode
      ? await this.prisma.priceRange.findUniqueOrThrow({ where: { code: dto.priceRangeCode } })
      : null;
    const slug = await this.generateUniqueSlug(dto.name);

    const address = await this.prisma.address.create({
      data: {
        line: dto.address.line,
        ward: dto.address.ward,
        // District no longer collected from any client — defaulted to ''
        // to satisfy the still-non-null DB column without a migration.
        district: dto.address.district ?? '',
        province: dto.address.province,
        fullAddressText: [dto.address.line, dto.address.ward, dto.address.district, dto.address.province]
          .filter(Boolean)
          .join(', '),
      },
    });
    const location = await this.prisma.location.create({ data: { lat: dto.location.lat, lng: dto.location.lng } });

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
        submittedBy: userId,
      },
    });
    // Starts 'pending' — ContributionFinalizeService flips this to
    // 'published'/'in_review'/'rejected' based on the moderation outcome
    // (or a later moderator decision), never left at the DB default.
    await this.prisma.restaurantStatus.create({ data: { restaurantId: restaurant.id, publicationStatus: 'pending' } });

    if (dto.cuisineCodes && dto.cuisineCodes.length > 0) {
      const cuisines = await this.prisma.cuisine.findMany({ where: { code: { in: dto.cuisineCodes } } });
      await this.prisma.restaurantCuisine.createMany({
        data: cuisines.map((c) => ({ restaurantId: restaurant.id, cuisineId: c.id })),
      });
    }

    if (dto.openingHours && dto.openingHours.length > 0) {
      await this.prisma.openingHour.createMany({
        data: dto.openingHours.map((day) => ({
          restaurantId: restaurant.id,
          dayOfWeek: day.dayOfWeek,
          openTime: day.isClosed || !day.openTime ? null : this.parseTime(day.openTime),
          closeTime: day.isClosed || !day.closeTime ? null : this.parseTime(day.closeTime),
          isClosed: day.isClosed,
        })),
      });
    }

    if (dto.facilities && dto.facilities.length > 0) {
      await this.prisma.restaurantFacility.createMany({
        data: dto.facilities.map((facilityType) => ({ restaurantId: restaurant.id, facilityType })),
      });
    }

    if (dto.menuItems && dto.menuItems.length > 0) {
      const menu = await this.prisma.menu.create({ data: { restaurantId: restaurant.id, isActive: true } });
      // Best-effort link to the curated Dish catalog, same rule as
      // admin-restaurant.service.ts's addMenuItem — never creates a new Dish
      // from a contributor's free-text input, only links an exact match.
      const dishes = await this.prisma.dish.findMany({
        where: { name: { in: dto.menuItems.map((item) => item.name), mode: 'insensitive' } },
      });
      const dishIdByName = new Map(dishes.map((dish) => [dish.name.toLowerCase(), dish.id]));
      await this.prisma.menuItem.createMany({
        data: dto.menuItems.map((item) => ({
          menuId: menu.id,
          dishId: dishIdByName.get(item.name.toLowerCase()) ?? null,
          name: item.name,
          priceVnd: item.priceVnd,
          category: item.category,
          isPopular: item.isPopular ?? false,
        })),
      });
    }

    await this.mediaService.reparent(userId, dto.photoIds, 'restaurant', restaurant.id);

    const contribution = await this.prisma.contribution.create({
      data: {
        id: randomUUID(),
        userId,
        type: 'new_restaurant',
        targetRestaurantId: restaurant.id,
        payload: dto as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    const moderation = await this.moderationService.check({
      userId,
      textContent: dto.description ?? null,
      menuItemPricesVnd: dto.menuItems?.map((item) => item.priceVnd),
    });
    const moderationResultId = await this.moderationService.recordResult(contribution.id, moderation);
    await this.prisma.contribution.update({ where: { id: contribution.id }, data: { moderationResultId } });

    const status = await this.finalizeService.finalizeAfterModeration(contribution.id, moderation);

    return { restaurantId: restaurant.id, contributionId: contribution.id, status };
  }

  async createEditSuggestion(
    restaurantId: string,
    dto: CreateEditSuggestionDto,
    userId: string,
  ): Promise<CreateEditSuggestionResponse> {
    const oldValue = await this.readCurrentFieldValue(restaurantId, dto.fieldName);

    const contribution = await this.prisma.contribution.create({
      data: {
        userId,
        type: 'edit_suggestion',
        targetRestaurantId: restaurantId,
        payload: { fieldName: dto.fieldName, newValue: dto.newValue } as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
    await this.prisma.editSuggestion.create({
      data: {
        contributionId: contribution.id,
        fieldName: dto.fieldName,
        oldValue: (oldValue ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        newValue: dto.newValue as Prisma.InputJsonValue,
      },
    });

    const moderation = await this.moderationService.check({
      userId,
      textContent: typeof dto.newValue === 'string' ? dto.newValue : null,
    });
    const moderationResultId = await this.moderationService.recordResult(contribution.id, moderation);
    await this.prisma.contribution.update({ where: { id: contribution.id }, data: { moderationResultId } });

    const status = await this.finalizeService.finalizeAfterModeration(contribution.id, moderation);
    return { contributionId: contribution.id, status };
  }

  async createStatusReport(
    restaurantId: string,
    dto: CreateStatusReportDto,
    userId: string,
  ): Promise<CreateStatusReportResponse> {
    const restaurant = await this.prisma.restaurant.findFirst({ where: { id: restaurantId, deletedAt: null } });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }

    const isClosureReport = dto.kind === 'closure';
    const payload = {
      kind: dto.kind,
      crowdedLevel: dto.crowdedLevel,
      seatLevel: dto.seatLevel,
      outletLevel: dto.outletLevel,
      hasCarParking: dto.hasCarParking,
      hasMotorbikeParking: dto.hasMotorbikeParking,
      isFree: dto.isFree,
      notes: dto.notes,
      description: dto.description,
    };

    const contribution = await this.prisma.contribution.create({
      data: {
        userId,
        type: isClosureReport ? 'closure_report' : 'status_update',
        targetRestaurantId: restaurantId,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    const textContent = dto.description ?? dto.notes ?? null;
    const moderation = await this.moderationService.check({ userId, textContent });
    const moderationResultId = await this.moderationService.recordResult(contribution.id, moderation);
    await this.prisma.contribution.update({ where: { id: contribution.id }, data: { moderationResultId } });

    const status = await this.finalizeService.finalizeAfterModeration(contribution.id, moderation);

    if (isClosureReport) {
      await this.checkClosureEscalation(restaurantId);
    }

    return { contributionId: contribution.id, status };
  }

  /**
   * Business rule (ERD §7): 3+ INDEPENDENT (distinct-user) closure_report
   * contributions on the same restaurant within a rolling 14-day window
   * escalates that restaurant's most recent closure ModerationResult to
   * high-priority and pulls it back into the moderation queue (decision
   * reset to 'pending') even if it had auto-approved cleanly on its own —
   * a single closure report rarely trips any text heuristic, so most
   * closure reports start out auto_approve/approved, and the escalation is
   * exactly what's supposed to override that. Never auto-hides the
   * restaurant — only surfaces it prominently in the queue.
   *
   * Guarded by `decidedBy: null` (not `decision: 'pending'`) — the only
   * thing this must never reopen is an item a real MODERATOR already acted
   * on (Phase 5); the rule-based stand-in's own auto-approval is not a
   * final human decision and must remain escalatable.
   */
  async checkClosureEscalation(restaurantId: string): Promise<void> {
    const windowStart = new Date(Date.now() - CLOSURE_ESCALATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentReports = await this.prisma.contribution.findMany({
      where: { targetRestaurantId: restaurantId, type: 'closure_report', createdAt: { gte: windowStart } },
      select: { id: true, userId: true, moderationResultId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const distinctReporters = new Set(recentReports.map((r) => r.userId));
    if (distinctReporters.size !== CLOSURE_ESCALATION_REPORTER_COUNT) return;

    const latest = recentReports[0];
    if (!latest?.moderationResultId) return;

    const escalated = await this.prisma.moderationResult.updateMany({
      where: { id: latest.moderationResultId, decidedBy: null },
      data: {
        riskScore: new Prisma.Decimal('1.00'),
        recommendedAction: 'hold_for_review',
        decision: 'pending',
        labels: { push: 'closure_escalation' },
      },
    });
    if (escalated.count === 0) return; // already decided by a real moderator — never reopen.

    await this.prisma.contribution.update({ where: { id: latest.id }, data: { status: 'in_review' } });

    // aiReason needs a separate read-then-write since Prisma can't
    // concatenate strings in one call; the `!includes` check keeps this
    // idempotent if checkClosureEscalation were ever invoked twice for the
    // same crossing point.
    const target = await this.prisma.moderationResult.findUnique({ where: { id: latest.moderationResultId } });
    if (target && !target.aiReason.includes('closure_escalation')) {
      await this.prisma.moderationResult.update({
        where: { id: latest.moderationResultId },
        data: { aiReason: `${target.aiReason} — 3+ báo cáo đóng cửa độc lập trong 14 ngày.` },
      });
    }
  }

  async listMyContributions(userId: string, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE): Promise<ContributionListResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { userId },
        include: { targetRestaurant: { select: { name: true } }, moderationResult: { select: { aiReason: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contribution.count({ where: { userId } }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        targetRestaurantId: row.targetRestaurantId,
        targetRestaurantName: row.targetRestaurant?.name ?? null,
        status: row.status,
        aiReason: row.moderationResult?.aiReason ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getContribution(id: string, userId: string) {
    const row = await this.prisma.contribution.findUnique({
      where: { id },
      include: { targetRestaurant: { select: { name: true } }, moderationResult: { select: { aiReason: true } } },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy đóng góp');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem đóng góp này');
    }
    return {
      id: row.id,
      type: row.type,
      targetRestaurantId: row.targetRestaurantId,
      targetRestaurantName: row.targetRestaurant?.name ?? null,
      status: row.status as ContributionStatus,
      aiReason: row.moderationResult?.aiReason ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async readCurrentFieldValue(restaurantId: string, fieldName: string): Promise<unknown> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      include: { address: true, openingHours: true, facilities: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }

    switch (fieldName) {
      case 'name':
        return restaurant.name;
      case 'description':
        return restaurant.description;
      case 'phone':
        return restaurant.phone;
      case 'address.line':
        return restaurant.address.line;
      case 'address.ward':
        return restaurant.address.ward;
      case 'address.district':
        return restaurant.address.district;
      case 'address.province':
        return restaurant.address.province;
      case 'openingHours':
        return restaurant.openingHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        }));
      case 'facilities':
        return restaurant.facilities.map((f) => f.facilityType);
      default:
        throw new BadRequestException('Trường không hợp lệ');
    }
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
