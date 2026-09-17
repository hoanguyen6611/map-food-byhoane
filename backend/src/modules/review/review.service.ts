import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Review } from '@prisma/client';
import type {
  CreateReviewRequest,
  MyReviewListResponse,
  PhotoDto,
  ReviewCriteriaBreakdownDto,
  ReviewCriteriaCode,
  ReviewDto,
  ReviewListResponse,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NotificationService } from '../notification/notification.service';
import { CompositeScoreService } from './composite-score.service';
import {
  ReviewModerationService,
  type ModerationCheckResult,
} from './review-moderation.service';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import type { ReviewListQueryDto } from './dto/review-list-query.dto';
import type { ReviewRatingInputDto } from './dto/review-rating-input.dto';

const DEFAULT_MY_REVIEWS_PAGE_SIZE = 20;

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const EDIT_MARKER_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;

const REVIEW_INCLUDE = {
  user: { include: { profile: true } },
  ratings: { include: { criteria: true } },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof REVIEW_INCLUDE;
}>;

// Shape shared by CreateReviewDto (minus restaurantId, all required) and
// UpdateReviewDto (all optional) — CreateReviewDto's required fields are
// structurally assignable here, so both DTOs satisfy this without a cast.
type ReviewPatchInput = Partial<
  Pick<
    CreateReviewRequest,
    | 'overallRating'
    | 'ratings'
    | 'comment'
    | 'dishesOrdered'
    | 'billTotalVnd'
    | 'partySize'
    | 'visitedAt'
    | 'waitTimeMinutes'
    | 'wouldReturn'
  >
> & { photoIds?: string[] };

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ReviewModerationService,
    private readonly compositeScoreService: CompositeScoreService,
    private readonly mediaService: MediaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateReviewDto, userId: string): Promise<ReviewDto> {
    this.assertUniqueCriteria(dto.ratings);
    const criteriaIdByCode = await this.resolveCriteriaIds(
      dto.ratings.map((r) => r.criteriaCode),
    );

    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id: dto.restaurantId,
        deletedAt: null,
        status: { publicationStatus: 'published' },
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }

    const existing = await this.prisma.review.findFirst({
      where: { userId, restaurantId: dto.restaurantId, deletedAt: null },
    });

    if (existing) {
      // "One active review per user per restaurant" (docs/06-database-erd.md
      // §5) — re-submitting updates the existing row rather than creating a
      // duplicate, UNLESS it's within the 24h anti-spam window (US-E5), in
      // which case it's blocked outright.
      const lastTouched =
        existing.updatedAt.getTime() > existing.createdAt.getTime()
          ? existing.updatedAt
          : existing.createdAt;
      if (Date.now() - lastTouched.getTime() < DUPLICATE_WINDOW_MS) {
        throw new ConflictException('Bạn đã đánh giá quán này gần đây');
      }
      return this.applyUpdate(existing, dto);
    }

    const created = await this.prisma.review.create({
      data: {
        userId,
        restaurantId: dto.restaurantId,
        overallRating: dto.overallRating,
        comment: dto.comment,
        dishesOrdered: dto.dishesOrdered ?? [],
        billTotalVnd: dto.billTotalVnd,
        partySize: dto.partySize,
        visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : undefined,
        waitTimeMinutes: dto.waitTimeMinutes,
        wouldReturn: dto.wouldReturn,
        ratings: {
          create: dto.ratings.map((r) => ({
            criteriaId: criteriaIdByCode.get(r.criteriaCode)!,
            score: r.score,
          })),
        },
      },
    });

    if (dto.photoIds && dto.photoIds.length > 0) {
      await this.mediaService.reparent(
        userId,
        dto.photoIds,
        'review',
        created.id,
      );
    }

    await this.runModerationAndFinalize(
      created.id,
      userId,
      dto.restaurantId,
      dto.comment ?? null,
    );
    await this.compositeScoreService.enqueueRecompute(dto.restaurantId);
    return this.getByIdOrThrow(created.id);
  }

  async update(
    reviewId: string,
    dto: UpdateReviewDto,
    userId: string,
  ): Promise<ReviewDto> {
    const existing = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }
    return this.applyUpdate(existing, dto);
  }

  async remove(reviewId: string, userId: string): Promise<void> {
    const existing = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xoá đánh giá này');
    }
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });
    await this.compositeScoreService.enqueueRecompute(existing.restaurantId);
  }

  // "My Reviews" (profile) — unlike listForRestaurant, deliberately includes
  // every status (pending/rejected/hidden too), not just 'published': this
  // is the author's own view of their history, not the public-facing list.
  async listMine(
    userId: string,
    page = 1,
    pageSize = DEFAULT_MY_REVIEWS_PAGE_SIZE,
  ): Promise<MyReviewListResponse> {
    const where: Prisma.ReviewWhereInput = { userId, deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { ...REVIEW_INCLUDE, restaurant: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);

    const restaurantIds = rows.map((r) => r.restaurantId);
    const thumbnailByRestaurantId =
      await this.batchFetchRestaurantThumbnails(restaurantIds);
    const photosByReviewId = await this.batchFetchPhotos(rows.map((r) => r.id));

    return {
      items: rows.map((r) => ({
        ...this.toDto(r, photosByReviewId.get(r.id) ?? []),
        restaurant: {
          id: r.restaurant.id,
          name: r.restaurant.name,
          thumbnailUrl: thumbnailByRestaurantId.get(r.restaurantId) ?? null,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  private async batchFetchRestaurantThumbnails(
    restaurantIds: string[],
  ): Promise<Map<string, string>> {
    if (restaurantIds.length === 0) return new Map();
    const photos = await this.prisma.photo.findMany({
      where: {
        ownerType: 'restaurant',
        ownerId: { in: restaurantIds },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, string>();
    for (const photo of photos) {
      if (photo.ownerId && !map.has(photo.ownerId)) {
        map.set(photo.ownerId, this.mediaService.resolveUrl(photo.storageKey));
      }
    }
    return map;
  }

  async listForRestaurant(
    restaurantId: string,
    query: ReviewListQueryDto,
  ): Promise<ReviewListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.ReviewWhereInput = {
      restaurantId,
      status: 'published',
      deletedAt: null,
      ...(query.filter ? { overallRating: query.filter } : {}),
    };

    // 'most_helpful' still degrades to 'newest' — there's no helpfulness-vote
    // model anywhere in scope. 'has_photos' now genuinely reorders (gap-fix:
    // Module 7's photo pipeline exists now, unlike when this comment was
    // originally written) — see fetchHasPhotosOrder for why it needs its own
    // path rather than a plain `orderBy`.
    const [rows, total] =
      query.sort === 'has_photos'
        ? await this.listForRestaurantSortedByPhotos(where, page, pageSize)
        : await Promise.all([
            this.prisma.review.findMany({
              where,
              include: REVIEW_INCLUDE,
              orderBy: { createdAt: 'desc' },
              skip: (page - 1) * pageSize,
              take: pageSize,
            }),
            this.prisma.review.count({ where }),
          ]);

    const criteria = await this.prisma.reviewCriteria.findMany();
    const photosByReviewId = await this.batchFetchPhotos(rows.map((r) => r.id));

    return {
      items: rows.map((r) => this.toDto(r, photosByReviewId.get(r.id) ?? [])),
      total,
      page,
      pageSize,
      ratingBreakdown: await this.buildRatingBreakdown(restaurantId, criteria),
    };
  }

  /**
   * `has_photos` sort needs "reviews with ≥1 approved photo first, newest
   * first within each group" computed across the FULL matching set before
   * pagination — Photo has no Prisma relation back to Review (`ownerId` is a
   * loose polymorphic reference, see Photo's schema comment), so this can't
   * be expressed as a plain `orderBy`. Fetches lightweight (id, createdAt)
   * rows for everything matching, partitions in JS, then re-fetches only the
   * requested page's full rows — cheap since only ids/timestamps are fetched
   * for the full set.
   */
  private async listForRestaurantSortedByPhotos(
    where: Prisma.ReviewWhereInput,
    page: number,
    pageSize: number,
  ): Promise<[ReviewWithRelations[], number]> {
    const allMatching = await this.prisma.review.findMany({
      where,
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const withPhotoRows = await this.prisma.photo.findMany({
      where: {
        ownerType: 'review',
        ownerId: { in: allMatching.map((r) => r.id) },
        status: 'approved',
        deletedAt: null,
      },
      select: { ownerId: true },
      distinct: ['ownerId'],
    });
    const idsWithPhotos = new Set(withPhotoRows.map((p) => p.ownerId));

    const sortedIds = [...allMatching]
      .sort((a, b) => {
        const aHas = idsWithPhotos.has(a.id) ? 1 : 0;
        const bHas = idsWithPhotos.has(b.id) ? 1 : 0;
        return aHas !== bHas
          ? bHas - aHas
          : b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map((r) => r.id);
    const pageIds = sortedIds.slice(
      (page - 1) * pageSize,
      (page - 1) * pageSize + pageSize,
    );

    const pageRows = await this.prisma.review.findMany({
      where: { id: { in: pageIds } },
      include: REVIEW_INCLUDE,
    });
    const rowById = new Map(pageRows.map((r) => [r.id, r]));
    const orderedRows = pageIds
      .map((id) => rowById.get(id))
      .filter((row): row is ReviewWithRelations => row !== undefined);

    return [orderedRows, allMatching.length];
  }

  private async applyUpdate(
    existing: Review,
    patch: ReviewPatchInput,
  ): Promise<ReviewDto> {
    if (patch.ratings) {
      this.assertUniqueCriteria(patch.ratings);
    }

    const now = new Date();
    const editedAt =
      now.getTime() - existing.createdAt.getTime() > EDIT_MARKER_WINDOW_MS
        ? now
        : existing.editedAt;

    const data: Prisma.ReviewUpdateInput = { editedAt };
    if (patch.overallRating !== undefined)
      data.overallRating = patch.overallRating;
    if (patch.comment !== undefined) data.comment = patch.comment;
    if (patch.dishesOrdered !== undefined)
      data.dishesOrdered = patch.dishesOrdered;
    if (patch.billTotalVnd !== undefined)
      data.billTotalVnd = patch.billTotalVnd;
    if (patch.partySize !== undefined) data.partySize = patch.partySize;
    if (patch.visitedAt !== undefined)
      data.visitedAt = new Date(patch.visitedAt);
    if (patch.waitTimeMinutes !== undefined)
      data.waitTimeMinutes = patch.waitTimeMinutes;
    if (patch.wouldReturn !== undefined) data.wouldReturn = patch.wouldReturn;

    await this.prisma.review.update({ where: { id: existing.id }, data });

    if (patch.ratings) {
      const criteriaIdByCode = await this.resolveCriteriaIds(
        patch.ratings.map((r) => r.criteriaCode),
      );
      await this.prisma.$transaction([
        this.prisma.reviewRating.deleteMany({
          where: { reviewId: existing.id },
        }),
        this.prisma.reviewRating.createMany({
          data: patch.ratings.map((r) => ({
            reviewId: existing.id,
            criteriaId: criteriaIdByCode.get(r.criteriaCode)!,
            score: r.score,
          })),
        }),
      ]);
    }

    if (patch.photoIds && patch.photoIds.length > 0) {
      await this.mediaService.reparent(
        existing.userId,
        patch.photoIds,
        'review',
        existing.id,
      );
    }

    const commentForModeration =
      patch.comment !== undefined ? patch.comment : existing.comment;
    await this.runModerationAndFinalize(
      existing.id,
      existing.userId,
      existing.restaurantId,
      commentForModeration,
    );
    await this.compositeScoreService.enqueueRecompute(existing.restaurantId);
    return this.getByIdOrThrow(existing.id);
  }

  // Fail-safe (build-prompts/07's requirement, reinterpreted for the
  // rule-based stand-in since there's no real AI API call to simulate an
  // outage for): if the moderation check itself throws, never let the
  // review fall through to auto-published — hold it for manual review
  // instead. `status` defaults to 'pending' at creation anyway, so on
  // create() a thrown check is a no-op continuation of that default; on
  // update() it explicitly re-holds a possibly-already-published review.
  private async runModerationAndFinalize(
    reviewId: string,
    userId: string,
    restaurantId: string,
    comment: string | null,
  ): Promise<void> {
    let moderation: ModerationCheckResult | null = null;
    try {
      moderation = await this.moderationService.check({ userId, comment });
    } catch (error) {
      this.logger.error(
        `Moderation check failed for review ${reviewId}, holding for manual review: ${String(error)}`,
      );
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { status: 'pending' },
      });
    }
    if (moderation) {
      await this.moderationService.recordResult(reviewId, moderation);
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          status:
            moderation.recommendedAction === 'auto_approve'
              ? 'published'
              : 'pending',
        },
      });
    }
    if (!moderation || moderation.recommendedAction !== 'auto_approve') {
      await this.notifyAdminsOfPendingReview(reviewId, restaurantId);
    }
  }

  // Best-effort — same "downstream producer failure must never break the
  // core flow" philosophy as NotificationService.create()'s push-delivery
  // call. A notification failure here must never fail the review submission
  // itself, which has already been persisted.
  private async notifyAdminsOfPendingReview(reviewId: string, restaurantId: string): Promise<void> {
    try {
      await this.sendPendingReviewNotification(reviewId, restaurantId);
    } catch (error) {
      this.logger.error(`Failed to notify admins of pending review ${reviewId}`, error instanceof Error ? error.stack : error);
    }
  }

  private async sendPendingReviewNotification(reviewId: string, restaurantId: string): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    await this.notificationService.notifyAdmins('moderation_queue_new', {
      title: 'Đánh giá mới cần duyệt',
      body: restaurant?.name ?? 'Một đánh giá mới',
      deepLink: {
        screen: 'AdminModeration',
        moderationTargetType: 'review',
        reviewId,
        restaurantId,
      },
    });
  }

  private async getByIdOrThrow(id: string): Promise<ReviewDto> {
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id },
      include: REVIEW_INCLUDE,
    });
    const photos = await this.prisma.photo.findMany({
      where: { ownerType: 'review', ownerId: id, deletedAt: null },
    });
    return this.toDto(
      review,
      photos.map((p) => ({
        id: p.id,
        url: this.mediaService.resolveUrl(p.storageKey),
        width: p.width,
        height: p.height,
      })),
    );
  }

  private async batchFetchPhotos(
    reviewIds: string[],
  ): Promise<Map<string, PhotoDto[]>> {
    if (reviewIds.length === 0) return new Map();
    const photos = await this.prisma.photo.findMany({
      where: {
        ownerType: 'review',
        ownerId: { in: reviewIds },
        deletedAt: null,
        status: 'approved',
      },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, PhotoDto[]>();
    for (const photo of photos) {
      if (!photo.ownerId) continue;
      const list = map.get(photo.ownerId) ?? [];
      list.push({
        id: photo.id,
        url: this.mediaService.resolveUrl(photo.storageKey),
        width: photo.width,
        height: photo.height,
      });
      map.set(photo.ownerId, list);
    }
    return map;
  }

  private async buildRatingBreakdown(
    restaurantId: string,
    criteria: { id: string; code: string; label: string }[],
  ): Promise<ReviewCriteriaBreakdownDto[]> {
    const grouped = await this.prisma.reviewRating.groupBy({
      by: ['criteriaId'],
      where: { review: { restaurantId, status: 'published', deletedAt: null } },
      _avg: { score: true },
      _count: { _all: true },
    });
    const byCriteriaId = new Map(grouped.map((g) => [g.criteriaId, g]));
    return criteria.map((c) => {
      const g = byCriteriaId.get(c.id);
      return {
        code: c.code as ReviewCriteriaCode,
        label: c.label,
        averageScore: g?._avg.score ? Number(g._avg.score.toFixed(2)) : null,
        ratingCount: g?._count._all ?? 0,
      };
    });
  }

  private toDto(review: ReviewWithRelations, photos: PhotoDto[]): ReviewDto {
    return {
      id: review.id,
      restaurantId: review.restaurantId,
      author: {
        id: review.user.id,
        displayName: review.user.profile?.displayName ?? 'Người dùng ẩn danh',
      },
      overallRating: review.overallRating,
      ratings: review.ratings.map((r) => ({
        criteriaCode: r.criteria.code as ReviewCriteriaCode,
        score: r.score,
      })),
      comment: review.comment,
      dishesOrdered: review.dishesOrdered,
      billTotalVnd: review.billTotalVnd,
      partySize: review.partySize,
      visitedAt: review.visitedAt?.toISOString() ?? null,
      waitTimeMinutes: review.waitTimeMinutes,
      wouldReturn: review.wouldReturn,
      status: review.status,
      editedAt: review.editedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      photos,
    };
  }

  private assertUniqueCriteria(ratings: ReviewRatingInputDto[]): void {
    const codes = ratings.map((r) => r.criteriaCode);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Mỗi tiêu chí chỉ được đánh giá một lần');
    }
  }

  private async resolveCriteriaIds(
    codes: string[],
  ): Promise<Map<string, string>> {
    const unique = Array.from(new Set(codes));
    const rows = await this.prisma.reviewCriteria.findMany({
      where: { code: { in: unique } },
    });
    const map = new Map(rows.map((r) => [r.code, r.id]));
    for (const code of unique) {
      if (!map.has(code)) {
        throw new BadRequestException(`Tiêu chí không hợp lệ: ${code}`);
      }
    }
    return map;
  }
}
