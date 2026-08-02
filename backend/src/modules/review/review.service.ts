import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Review } from '@prisma/client';
import type {
  CreateReviewRequest,
  ReviewCriteriaBreakdownDto,
  ReviewCriteriaCode,
  ReviewDto,
  ReviewListResponse,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CompositeScoreService } from './composite-score.service';
import { ReviewModerationService } from './review-moderation.service';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import type { ReviewListQueryDto } from './dto/review-list-query.dto';
import type { ReviewRatingInputDto } from './dto/review-rating-input.dto';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const EDIT_MARKER_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;

const REVIEW_INCLUDE = {
  user: { include: { profile: true } },
  ratings: { include: { criteria: true } },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

// Shape shared by CreateReviewDto (minus restaurantId, all required) and
// UpdateReviewDto (all optional) — CreateReviewDto's required fields are
// structurally assignable here, so both DTOs satisfy this without a cast.
type ReviewPatchInput = Partial<
  Pick<
    CreateReviewRequest,
    'overallRating' | 'ratings' | 'comment' | 'dishesOrdered' | 'billTotalVnd' | 'partySize' | 'visitedAt' | 'waitTimeMinutes' | 'wouldReturn'
  >
>;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ReviewModerationService,
    private readonly compositeScoreService: CompositeScoreService,
  ) {}

  async create(dto: CreateReviewDto, userId: string): Promise<ReviewDto> {
    this.assertUniqueCriteria(dto.ratings);
    const criteriaIdByCode = await this.resolveCriteriaIds(dto.ratings.map((r) => r.criteriaCode));

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: dto.restaurantId, deletedAt: null, status: { publicationStatus: 'published' } },
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
      const lastTouched = existing.updatedAt.getTime() > existing.createdAt.getTime() ? existing.updatedAt : existing.createdAt;
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
          create: dto.ratings.map((r) => ({ criteriaId: criteriaIdByCode.get(r.criteriaCode)!, score: r.score })),
        },
      },
    });

    await this.runModerationAndFinalize(created.id, userId, dto.comment ?? null);
    await this.compositeScoreService.enqueueRecompute(dto.restaurantId);
    return this.getByIdOrThrow(created.id);
  }

  async update(reviewId: string, dto: UpdateReviewDto, userId: string): Promise<ReviewDto> {
    const existing = await this.prisma.review.findFirst({ where: { id: reviewId, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }
    return this.applyUpdate(existing, dto);
  }

  async remove(reviewId: string, userId: string): Promise<void> {
    const existing = await this.prisma.review.findFirst({ where: { id: reviewId, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xoá đánh giá này');
    }
    await this.prisma.review.update({ where: { id: reviewId }, data: { deletedAt: new Date() } });
    await this.compositeScoreService.enqueueRecompute(existing.restaurantId);
  }

  async listForRestaurant(restaurantId: string, query: ReviewListQueryDto): Promise<ReviewListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.ReviewWhereInput = {
      restaurantId,
      status: 'published',
      deletedAt: null,
      ...(query.filter ? { overallRating: query.filter } : {}),
    };

    // 'most_helpful' and 'has_photos' both degrade to 'newest' ordering —
    // there's no helpfulness-vote model anywhere in scope yet, and reviews
    // never carry photos in this module (Module 6 explicitly defers the
    // upload pipeline to Module 7). Accepting the values keeps the mobile
    // sort dropdown forward-compatible without fabricating a signal that
    // doesn't exist. See ReviewSort in packages/shared-types/src/review.ts.
    const orderBy: Prisma.ReviewOrderByWithRelationInput = { createdAt: 'desc' };

    const [rows, total, criteria] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
      this.prisma.reviewCriteria.findMany(),
    ]);

    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      page,
      pageSize,
      ratingBreakdown: await this.buildRatingBreakdown(restaurantId, criteria),
    };
  }

  private async applyUpdate(existing: Review, patch: ReviewPatchInput): Promise<ReviewDto> {
    if (patch.ratings) {
      this.assertUniqueCriteria(patch.ratings);
    }

    const now = new Date();
    const editedAt = now.getTime() - existing.createdAt.getTime() > EDIT_MARKER_WINDOW_MS ? now : existing.editedAt;

    const data: Prisma.ReviewUpdateInput = { editedAt };
    if (patch.overallRating !== undefined) data.overallRating = patch.overallRating;
    if (patch.comment !== undefined) data.comment = patch.comment;
    if (patch.dishesOrdered !== undefined) data.dishesOrdered = patch.dishesOrdered;
    if (patch.billTotalVnd !== undefined) data.billTotalVnd = patch.billTotalVnd;
    if (patch.partySize !== undefined) data.partySize = patch.partySize;
    if (patch.visitedAt !== undefined) data.visitedAt = new Date(patch.visitedAt);
    if (patch.waitTimeMinutes !== undefined) data.waitTimeMinutes = patch.waitTimeMinutes;
    if (patch.wouldReturn !== undefined) data.wouldReturn = patch.wouldReturn;

    await this.prisma.review.update({ where: { id: existing.id }, data });

    if (patch.ratings) {
      const criteriaIdByCode = await this.resolveCriteriaIds(patch.ratings.map((r) => r.criteriaCode));
      await this.prisma.$transaction([
        this.prisma.reviewRating.deleteMany({ where: { reviewId: existing.id } }),
        this.prisma.reviewRating.createMany({
          data: patch.ratings.map((r) => ({
            reviewId: existing.id,
            criteriaId: criteriaIdByCode.get(r.criteriaCode)!,
            score: r.score,
          })),
        }),
      ]);
    }

    const commentForModeration = patch.comment !== undefined ? patch.comment : existing.comment;
    await this.runModerationAndFinalize(existing.id, existing.userId, commentForModeration);
    await this.compositeScoreService.enqueueRecompute(existing.restaurantId);
    return this.getByIdOrThrow(existing.id);
  }

  private async runModerationAndFinalize(reviewId: string, userId: string, comment: string | null): Promise<void> {
    const moderation = await this.moderationService.check({ userId, comment });
    await this.moderationService.recordResult(reviewId, moderation);
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: moderation.recommendedAction === 'auto_approve' ? 'published' : 'pending' },
    });
  }

  private async getByIdOrThrow(id: string): Promise<ReviewDto> {
    const review = await this.prisma.review.findUniqueOrThrow({ where: { id }, include: REVIEW_INCLUDE });
    return this.toDto(review);
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

  private toDto(review: ReviewWithRelations): ReviewDto {
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
    };
  }

  private assertUniqueCriteria(ratings: ReviewRatingInputDto[]): void {
    const codes = ratings.map((r) => r.criteriaCode);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Mỗi tiêu chí chỉ được đánh giá một lần');
    }
  }

  private async resolveCriteriaIds(codes: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(codes));
    const rows = await this.prisma.reviewCriteria.findMany({ where: { code: { in: unique } } });
    const map = new Map(rows.map((r) => [r.code, r.id]));
    for (const code of unique) {
      if (!map.has(code)) {
        throw new BadRequestException(`Tiêu chí không hợp lệ: ${code}`);
      }
    }
    return map;
  }
}
