import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Review } from '@prisma/client';
import type { AdminReviewListItemDto, Paginated } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CompositeScoreService } from '../review/composite-score.service';
import { AuditLogService } from './audit-log.service';
import type { AdminReviewQueryDto } from './dto/admin-review-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

// Admin Review Management (docs/04-screen-list.md §32) — managing ALREADY
// PUBLISHED reviews (hide/restore/delete after the fact). Distinct from
// AdminModerationController, which only handles the pending-decision queue
// for content that hasn't been published yet.
@Injectable()
export class AdminReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly compositeScoreService: CompositeScoreService,
  ) {}

  async list(query: AdminReviewQueryDto): Promise<Paginated<AdminReviewListItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    // minRiskScore needs a review-id allowlist computed up front — riskScore
    // lives on the polymorphic ModerationResult table, not on Review itself,
    // so it can't be expressed as a plain Prisma `where` on Review. This
    // matches "ever flagged at/above this score" (any ModerationResult row
    // for the review), not strictly its most-recent check — a reasonable
    // simplification for a moderation-history filter.
    let riskFilteredIds: string[] | undefined;
    if (query.minRiskScore !== undefined) {
      const flagged = await this.prisma.moderationResult.findMany({
        where: { targetType: 'review', riskScore: { gte: query.minRiskScore } },
        select: { targetId: true },
        distinct: ['targetId'],
      });
      riskFilteredIds = flagged.map((f) => f.targetId);
    }

    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      ...(query.restaurantId ? { restaurantId: query.restaurantId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { comment: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(riskFilteredIds ? { id: { in: riskFilteredIds } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { user: { include: { profile: true } }, restaurant: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);

    const items = await Promise.all(rows.map((row) => this.buildListItem(row)));
    return { items, total, page, pageSize };
  }

  /** Admin-only per the screen spec — enforced by RolesGuard on the controller, not re-checked here. */
  async hide(reviewId: string, actorId: string): Promise<void> {
    const review = await this.getActiveReview(reviewId);
    if (review.status === 'hidden') {
      throw new ConflictException('Đánh giá này đã bị ẩn.');
    }
    await this.prisma.review.update({ where: { id: reviewId }, data: { status: 'hidden' } });
    await this.auditLog.record({
      actorId,
      action: 'review.hide',
      targetType: 'review',
      targetId: reviewId,
      beforeState: { status: review.status },
      afterState: { status: 'hidden' },
    });
    await this.compositeScoreService.enqueueRecompute(review.restaurantId);
  }

  async restore(reviewId: string, actorId: string): Promise<void> {
    const review = await this.getActiveReview(reviewId);
    if (review.status !== 'hidden') {
      throw new ConflictException('Đánh giá này không ở trạng thái bị ẩn.');
    }
    await this.prisma.review.update({ where: { id: reviewId }, data: { status: 'published' } });
    await this.auditLog.record({
      actorId,
      action: 'review.restore',
      targetType: 'review',
      targetId: reviewId,
      beforeState: { status: 'hidden' },
      afterState: { status: 'published' },
    });
    await this.compositeScoreService.enqueueRecompute(review.restaurantId);
  }

  // "Xoá vĩnh viễn" per the screen spec — no restore path from here, unlike
  // hide/restore. Still a soft-delete (`deletedAt`) rather than a real SQL
  // DELETE, matching every other delete in this codebase (ReviewService.remove,
  // Photo moderation rejection, etc.) — irreversible via the admin UI, not at
  // the DB layer, which is the established convention throughout.
  async remove(reviewId: string, actorId: string): Promise<void> {
    const review = await this.getActiveReview(reviewId);
    await this.prisma.review.update({ where: { id: reviewId }, data: { deletedAt: new Date() } });
    await this.auditLog.record({
      actorId,
      action: 'review.admin_delete',
      targetType: 'review',
      targetId: reviewId,
      beforeState: { status: review.status },
      afterState: { deletedAt: true },
    });
    await this.compositeScoreService.enqueueRecompute(review.restaurantId);
  }

  private async getActiveReview(reviewId: string): Promise<Review> {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, deletedAt: null } });
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    return review;
  }

  private async buildListItem(
    review: Review & { user: { id: string; profile: { displayName: string } | null }; restaurant: { name: string } },
  ): Promise<AdminReviewListItemDto> {
    const latestModeration = await this.prisma.moderationResult.findFirst({
      where: { targetType: 'review', targetId: review.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: review.id,
      restaurantId: review.restaurantId,
      restaurantName: review.restaurant.name,
      author: { id: review.user.id, displayName: review.user.profile?.displayName ?? 'Người dùng ẩn danh' },
      overallRating: review.overallRating,
      comment: review.comment,
      status: review.status,
      riskScore: latestModeration ? Number(latestModeration.riskScore) : null,
      labels: latestModeration?.labels ?? [],
      createdAt: review.createdAt.toISOString(),
    };
  }
}
