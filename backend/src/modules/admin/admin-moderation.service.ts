import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ModerationResult } from '@prisma/client';
import type {
  AdminModerationDetailDto,
  AdminModerationQueueItemDto,
  ModerationDecision,
  NotificationDeepLink,
  NotificationType,
  Paginated,
  ReportDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ReportService } from '../moderation/report.service';
import { ContributionFinalizeService } from '../contribution/contribution-finalize.service';
import { S3Service } from '../media/s3.service';
import { assertDecisionAllowed } from '../moderation/moderation-decision.util';
import { AuditLogService } from './audit-log.service';
import type { AdminModerationQueryDto } from './dto/admin-moderation-query.dto';
import type { ModerationDecisionDto } from './dto/moderation-decision.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const CONTENT_KIND_LABELS: Record<string, string> = {
  review: 'Đánh giá',
  new_restaurant: 'Quán mới',
  edit_suggestion: 'Chỉnh sửa',
  status_update: 'Cập nhật trạng thái',
  closure_report: 'Báo cáo đóng cửa',
  photo: 'Ảnh',
  video: 'Video',
  restaurant: 'Nhà hàng bị báo cáo',
};

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly reportService: ReportService,
    private readonly contributionFinalizeService: ContributionFinalizeService,
    private readonly s3: S3Service,
  ) {}

  async list(
    query: AdminModerationQueryDto,
  ): Promise<Paginated<AdminModerationQueueItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    // Defaults to 'pending' — the queue's whole point is surfacing
    // undecided items; an explicit `decision` filter opts into history.
    const where: Prisma.ModerationResultWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      decision: query.decision ?? 'pending',
    };

    const [rows, total] = await Promise.all([
      this.prisma.moderationResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.moderationResult.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map((row) => this.buildQueueItem(row)),
    );
    return { items, total, page, pageSize };
  }

  /**
   * "Xem chi tiết" — the full submission behind a queue row's one-line
   * `contentSummary`, fetched only when an admin actually opens it (not
   * bundled into `list()`, which stays cheap for a page of 20 rows).
   */
  async getDetail(moderationResultId: string): Promise<AdminModerationDetailDto> {
    const moderationResult = await this.prisma.moderationResult.findUnique({
      where: { id: moderationResultId },
    });
    if (!moderationResult) {
      throw new NotFoundException('Không tìm thấy mục kiểm duyệt');
    }

    switch (moderationResult.targetType) {
      case 'contribution': {
        const contribution = await this.prisma.contribution.findUnique({
          where: { id: moderationResult.targetId },
          include: { targetRestaurant: true, editSuggestion: true },
        });
        if (!contribution) {
          throw new NotFoundException('Không tìm thấy nội dung đóng góp');
        }
        const payload = (contribution.payload ?? {}) as Record<string, unknown>;
        const photoIds = Array.isArray(payload.photoIds) ? (payload.photoIds as string[]) : [];
        const photoUrls = Array.isArray(payload.photoUrls) ? (payload.photoUrls as string[]) : [];
        const attachedPhotos = photoIds.length
          ? await this.prisma.photo.findMany({ where: { id: { in: photoIds } } })
          : [];
        return {
          kind: 'contribution',
          contributionType: contribution.type,
          targetRestaurantId: contribution.targetRestaurantId,
          targetRestaurantName: contribution.targetRestaurant?.name ?? null,
          payload,
          oldValue: contribution.editSuggestion?.oldValue ?? undefined,
          photos: [
            ...attachedPhotos.map((p) => ({ id: p.id, url: this.s3.publicUrl(p.storageKey) })),
            ...photoUrls.map((url, i) => ({ id: `external-${i}`, url })),
          ],
        };
      }
      case 'photo': {
        const photo = await this.prisma.photo.findUnique({
          where: { id: moderationResult.targetId },
          include: { uploader: { include: { profile: true } } },
        });
        if (!photo) {
          throw new NotFoundException('Không tìm thấy ảnh');
        }
        return {
          kind: 'photo',
          url: this.s3.publicUrl(photo.storageKey),
          uploaderDisplayName: photo.uploader?.profile?.displayName ?? 'Người dùng ẩn danh',
        };
      }
      case 'review': {
        const review = await this.prisma.review.findUnique({
          where: { id: moderationResult.targetId },
          include: {
            restaurant: { select: { name: true } },
            ratings: { include: { criteria: true } },
          },
        });
        if (!review) {
          throw new NotFoundException('Không tìm thấy đánh giá');
        }
        const reviewPhotos = await this.prisma.photo.findMany({
          where: { ownerType: 'review', ownerId: review.id, deletedAt: null },
        });
        return {
          kind: 'review',
          restaurantName: review.restaurant.name,
          overallRating: review.overallRating,
          comment: review.comment,
          ratings: review.ratings.map((r) => ({ criteriaCode: r.criteria.code, score: r.score })),
          photos: reviewPhotos.map((p) => ({ id: p.id, url: this.s3.publicUrl(p.storageKey) })),
        };
      }
      case 'restaurant': {
        const restaurant = await this.prisma.restaurant.findUnique({
          where: { id: moderationResult.targetId },
          include: { address: true, category: true },
        });
        if (!restaurant) {
          throw new NotFoundException('Không tìm thấy quán ăn');
        }
        return {
          kind: 'restaurant',
          name: restaurant.name,
          fullAddressText: restaurant.address.fullAddressText,
          categoryCode: restaurant.category.code,
        };
      }
      default:
        throw new BadRequestException(`Không hỗ trợ xem chi tiết cho loại "${moderationResult.targetType}"`);
    }
  }

  /**
   * The one action endpoint (approve/reject/request-edit). `reason` is
   * required unless approving — enforced here (server-side), mirrored
   * client-side in admin-web. Both `moderator` and `admin` can call this
   * (no @Roles override, unlike restaurant hard-delete) per the doc.
   */
  async decide(
    moderationResultId: string,
    dto: ModerationDecisionDto,
    actorId: string,
  ): Promise<void> {
    if (dto.decision !== 'approved' && !dto.reason) {
      throw new BadRequestException(
        'Cần nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa.',
      );
    }

    const moderationResult = await this.prisma.moderationResult.findUnique({
      where: { id: moderationResultId },
    });
    if (!moderationResult) {
      throw new NotFoundException('Không tìm thấy mục kiểm duyệt');
    }
    if (moderationResult.decision !== 'pending') {
      throw new ConflictException('Nội dung này đã được xử lý.');
    }

    assertDecisionAllowed(
      {
        recommendedAction: moderationResult.recommendedAction,
        riskScore: Number(moderationResult.riskScore),
      },
      dto.decision,
      actorId,
    );

    await this.prisma.moderationResult.update({
      where: { id: moderationResultId },
      data: {
        decision: dto.decision,
        decidedBy: actorId,
        decidedAt: new Date(),
      },
    });

    const sideEffect = await this.applyTargetSideEffect(
      moderationResult,
      dto.decision,
      actorId,
    );

    await this.auditLog.record({
      actorId,
      action: `moderation.${dto.decision}`,
      targetType: moderationResult.targetType,
      targetId: moderationResult.targetId,
      beforeState: { decision: 'pending' },
      afterState: { decision: dto.decision, reason: dto.reason },
    });

    if (sideEffect) {
      const isApprovedReview =
        moderationResult.targetType === 'review' && dto.decision === 'approved';
      const notificationType: NotificationType =
        moderationResult.targetType === 'review'
          ? 'moderation_result'
          : 'contribution_status';
      await this.notificationService.create(
        sideEffect.contributorUserId,
        notificationType,
        {
          title:
            isApprovedReview && sideEffect.restaurantName
              ? 'Đánh giá của bạn được duyệt'
              : this.decisionTitle(dto.decision, sideEffect.restaurantName),
          body:
            dto.reason ??
            (isApprovedReview && sideEffect.restaurantName
              ? `${sideEffect.restaurantName} — đánh giá ${sideEffect.overallRating} sao của bạn đã hiển thị trên trang quán.`
              : this.decisionDefaultBody(dto.decision, sideEffect.restaurantName)),
          deepLink: sideEffect.deepLink,
        },
      );
    }
  }

  /**
   * Returns the contributor's userId + a deep link the mobile app can
   * actually navigate with, or null if the target no longer exists.
   * Gap-fix: this used to send `{screen: 'RestaurantDetail', reviewId}` for
   * reviews — 'RestaurantDetail' needs a `restaurantId` param, not
   * `reviewId`, so NotificationsScreen's NAVIGABLE_SCREENS check (which only
   * ever recognized 'Reviews') could never match it; tapping either real
   * notification type just marked it read and never navigated anywhere.
   */
  private async applyTargetSideEffect(
    moderationResult: ModerationResult,
    decision: 'approved' | 'rejected' | 'edit_requested',
    actorId: string,
  ): Promise<{
    contributorUserId: string;
    deepLink: NotificationDeepLink;
    // The restaurant this decision is actually about — lets the
    // notification say "your review of Cà Phê Phin Cũ was approved"
    // instead of a generic "your content was approved" with no way to tell
    // which of the user's several submissions it refers to.
    restaurantName?: string;
    // Review-only — lets an approved-review notification say "your 5-star
    // review is now live" instead of the generic wording every other
    // decision/target type shares.
    overallRating?: number;
  } | null> {
    switch (moderationResult.targetType) {
      case 'review': {
        const review = await this.prisma.review.findUnique({
          where: { id: moderationResult.targetId },
          include: { restaurant: { select: { name: true } } },
        });
        if (!review) return null;
        const status =
          decision === 'approved'
            ? 'published'
            : decision === 'rejected'
              ? 'rejected'
              : 'pending';
        await this.prisma.review.update({
          where: { id: moderationResult.targetId },
          data: { status },
        });
        // 'Reviews' (restaurantId) — the only screen NotificationsScreen's
        // NAVIGABLE_SCREENS actually recognizes; the review's own id isn't a
        // navigable target on its own.
        return {
          contributorUserId: review.userId,
          deepLink: { screen: 'Reviews', restaurantId: review.restaurantId },
          restaurantName: review.restaurant.name,
          overallRating: review.overallRating,
        };
      }
      case 'contribution': {
        const contribution = await this.prisma.contribution.findUnique({
          where: { id: moderationResult.targetId },
          include: { targetRestaurant: { select: { name: true } } },
        });
        if (!contribution) return null;
        await this.contributionFinalizeService.applyModeratorDecision(
          moderationResult.targetId,
          {
            recommendedAction: moderationResult.recommendedAction,
            riskScore: Number(moderationResult.riskScore),
          },
          decision,
          actorId,
        );
        return {
          contributorUserId: contribution.userId,
          deepLink: {
            screen: 'SubmissionStatus',
            contributionId: contribution.id,
            // Lets a client resolve straight to the restaurant's detail
            // page (once published) instead of only a submission-status
            // screen — GET /restaurants/:id only returns it once its own
            // publicationStatus is 'published', so a rejected/still-pending
            // one naturally 404s there rather than needing a separate check.
            restaurantId: contribution.targetRestaurantId ?? undefined,
          },
          restaurantName: contribution.targetRestaurant?.name,
        };
      }
      case 'photo': {
        const photo = await this.prisma.photo.findUnique({
          where: { id: moderationResult.targetId },
        });
        if (!photo) return null;
        if (decision === 'rejected') {
          // deletedAt already hides it from every photo query (all filter
          // deletedAt: null) — status is set too, purely for an honest audit
          // trail on the row itself.
          await this.prisma.photo.update({
            where: { id: moderationResult.targetId },
            data: { status: 'rejected', deletedAt: new Date() },
          });
        } else if (decision === 'approved') {
          await this.prisma.photo.update({
            where: { id: moderationResult.targetId },
            data: { status: 'approved' },
          });
        }
        // No user notification for photo decisions — there's no mobile
        // screen to deep-link a bare photo status into (unlike review/
        // contribution, which have Reviews/SubmissionStatus). Sending one
        // anyway would just recreate the exact bug this method now fixes,
        // for a third case.
        return null;
      }
      default:
        return null;
    }
  }

  private decisionTitle(
    decision: ModerationDecision,
    restaurantName?: string,
  ): string {
    if (!restaurantName) {
      // Target was deleted/unresolvable by the time the notification was
      // built — fall back to the old generic wording rather than a title
      // with a visible gap in it.
      switch (decision) {
        case 'approved':
          return 'Nội dung của bạn đã được duyệt';
        case 'rejected':
          return 'Nội dung của bạn đã bị từ chối';
        case 'edit_requested':
          return 'Nội dung của bạn cần chỉnh sửa';
        default:
          return 'Cập nhật trạng thái nội dung';
      }
    }
    switch (decision) {
      case 'approved':
        return `Nội dung của bạn về ${restaurantName} đã được duyệt`;
      case 'rejected':
        return `Nội dung của bạn về ${restaurantName} đã bị từ chối`;
      case 'edit_requested':
        return `Nội dung của bạn về ${restaurantName} cần chỉnh sửa`;
      default:
        return `Cập nhật trạng thái nội dung về ${restaurantName}`;
    }
  }

  private decisionDefaultBody(
    decision: ModerationDecision,
    restaurantName?: string,
  ): string {
    const place = restaurantName ? ` cho ${restaurantName}` : '';
    switch (decision) {
      case 'approved':
        return `Nội dung bạn gửi${place} đã được kiểm duyệt và duyệt thành công.`;
      case 'rejected':
        return `Nội dung bạn gửi${place} không đáp ứng tiêu chuẩn cộng đồng.`;
      case 'edit_requested':
        return `Vui lòng chỉnh sửa và gửi lại nội dung${place}.`;
      default:
        return '';
    }
  }

  private async buildQueueItem(
    moderationResult: ModerationResult,
  ): Promise<AdminModerationQueueItemDto> {
    let contentKind = moderationResult.targetType as string;
    let contentSummary = '';
    let submitterDisplayName = 'Người dùng ẩn danh';
    let relatedReports: ReportDto[] = [];

    switch (moderationResult.targetType) {
      case 'review': {
        const review = await this.prisma.review.findUnique({
          where: { id: moderationResult.targetId },
          include: { user: { include: { profile: true } } },
        });
        contentSummary = review?.comment ?? '(Không có bình luận)';
        submitterDisplayName =
          review?.user.profile?.displayName ?? submitterDisplayName;
        relatedReports = await this.reportService.findByTarget(
          'review',
          moderationResult.targetId,
        );
        break;
      }
      case 'contribution': {
        const contribution = await this.prisma.contribution.findUnique({
          where: { id: moderationResult.targetId },
          include: {
            user: { include: { profile: true } },
            targetRestaurant: true,
          },
        });
        if (contribution) {
          contentKind = contribution.type;
          submitterDisplayName =
            contribution.user.profile?.displayName ?? submitterDisplayName;
          contentSummary = this.summarizeContribution(contribution);
          if (contribution.targetRestaurantId) {
            relatedReports = await this.reportService.findByTarget(
              'restaurant',
              contribution.targetRestaurantId,
            );
          }
        }
        break;
      }
      case 'photo': {
        const photo = await this.prisma.photo.findUnique({
          where: { id: moderationResult.targetId },
          include: { uploader: { include: { profile: true } } },
        });
        contentSummary = photo?.storageKey ?? '(Không tìm thấy ảnh)';
        submitterDisplayName =
          photo?.uploader?.profile?.displayName ?? submitterDisplayName;
        break;
      }
      case 'video':
        contentSummary = '(Video chưa được hỗ trợ)';
        break;
      case 'restaurant': {
        // No single "submitter" for an already-published restaurant being
        // reported — submitterDisplayName stays the generic default.
        const restaurant = await this.prisma.restaurant.findUnique({
          where: { id: moderationResult.targetId },
        });
        contentSummary = restaurant?.name ?? '(Không tìm thấy quán)';
        relatedReports = await this.reportService.findByTarget(
          'restaurant',
          moderationResult.targetId,
        );
        break;
      }
    }

    return {
      id: moderationResult.id,
      targetType: moderationResult.targetType,
      targetId: moderationResult.targetId,
      contentKind: CONTENT_KIND_LABELS[contentKind] ?? contentKind,
      contentSummary,
      submitterDisplayName,
      submittedAt: moderationResult.createdAt.toISOString(),
      riskScore: Number(moderationResult.riskScore),
      labels: moderationResult.labels,
      aiReason: moderationResult.aiReason,
      recommendedAction: moderationResult.recommendedAction,
      decision: moderationResult.decision,
      relatedReports,
    };
  }

  private summarizeContribution(contribution: {
    type: string;
    payload: unknown;
    targetRestaurant: { name: string } | null;
  }): string {
    const payload = (contribution.payload ?? {}) as Record<string, unknown>;
    switch (contribution.type) {
      case 'new_restaurant':
        return `Quán mới: ${String(payload.name ?? contribution.targetRestaurant?.name ?? '')}`;
      case 'edit_suggestion':
        return `Đề xuất sửa "${String(payload.fieldName ?? '')}"`;
      case 'status_update':
        return `Cập nhật (${String(payload.kind ?? '')}) — ${contribution.targetRestaurant?.name ?? ''}`;
      case 'closure_report':
        return `Báo cáo đóng cửa — ${contribution.targetRestaurant?.name ?? ''}`;
      default:
        return '';
    }
  }
}
