import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ModerationResult } from '@prisma/client';
import type {
  AdminModerationQueueItemDto,
  ModerationDecision,
  NotificationType,
  Paginated,
  ReportDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ReportService } from '../moderation/report.service';
import { ContributionFinalizeService } from '../contribution/contribution-finalize.service';
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
};

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly reportService: ReportService,
    private readonly contributionFinalizeService: ContributionFinalizeService,
  ) {}

  async list(query: AdminModerationQueryDto): Promise<Paginated<AdminModerationQueueItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    // Defaults to 'pending' — the queue's whole point is surfacing
    // undecided items; an explicit `decision` filter opts into history.
    const where: Prisma.ModerationResultWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      decision: query.decision ?? 'pending',
    };

    const [rows, total] = await Promise.all([
      this.prisma.moderationResult.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.moderationResult.count({ where }),
    ]);

    const items = await Promise.all(rows.map((row) => this.buildQueueItem(row)));
    return { items, total, page, pageSize };
  }

  /**
   * The one action endpoint (approve/reject/request-edit). `reason` is
   * required unless approving — enforced here (server-side), mirrored
   * client-side in admin-web. Both `moderator` and `admin` can call this
   * (no @Roles override, unlike restaurant hard-delete) per the doc.
   */
  async decide(moderationResultId: string, dto: ModerationDecisionDto, actorId: string): Promise<void> {
    if (dto.decision !== 'approved' && !dto.reason) {
      throw new BadRequestException('Cần nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa.');
    }

    const moderationResult = await this.prisma.moderationResult.findUnique({ where: { id: moderationResultId } });
    if (!moderationResult) {
      throw new NotFoundException('Không tìm thấy mục kiểm duyệt');
    }
    if (moderationResult.decision !== 'pending') {
      throw new ConflictException('Nội dung này đã được xử lý.');
    }

    assertDecisionAllowed(
      { recommendedAction: moderationResult.recommendedAction, riskScore: Number(moderationResult.riskScore) },
      dto.decision,
      actorId,
    );

    await this.prisma.moderationResult.update({
      where: { id: moderationResultId },
      data: { decision: dto.decision, decidedBy: actorId, decidedAt: new Date() },
    });

    const contributorUserId = await this.applyTargetSideEffect(moderationResult, dto.decision, actorId);

    await this.auditLog.record({
      actorId,
      action: `moderation.${dto.decision}`,
      targetType: moderationResult.targetType,
      targetId: moderationResult.targetId,
      beforeState: { decision: 'pending' },
      afterState: { decision: dto.decision, reason: dto.reason },
    });

    if (contributorUserId) {
      const notificationType: NotificationType = moderationResult.targetType === 'review' ? 'moderation_result' : 'contribution_status';
      await this.notificationService.create(contributorUserId, notificationType, {
        title: this.decisionTitle(dto.decision),
        body: dto.reason ?? this.decisionDefaultBody(dto.decision),
        deepLink: { screen: moderationResult.targetType === 'review' ? 'RestaurantDetail' : 'SubmissionStatus', reviewId: moderationResult.targetType === 'review' ? moderationResult.targetId : undefined },
      });
    }
  }

  /** Returns the contributor's userId (for notification), or null if the target no longer exists. */
  private async applyTargetSideEffect(
    moderationResult: ModerationResult,
    decision: 'approved' | 'rejected' | 'edit_requested',
    actorId: string,
  ): Promise<string | null> {
    switch (moderationResult.targetType) {
      case 'review': {
        const review = await this.prisma.review.findUnique({ where: { id: moderationResult.targetId } });
        if (!review) return null;
        const status = decision === 'approved' ? 'published' : decision === 'rejected' ? 'rejected' : 'pending';
        await this.prisma.review.update({ where: { id: moderationResult.targetId }, data: { status } });
        return review.userId;
      }
      case 'contribution': {
        const contribution = await this.prisma.contribution.findUnique({ where: { id: moderationResult.targetId } });
        if (!contribution) return null;
        await this.contributionFinalizeService.applyModeratorDecision(
          moderationResult.targetId,
          { recommendedAction: moderationResult.recommendedAction, riskScore: Number(moderationResult.riskScore) },
          decision,
          actorId,
        );
        return contribution.userId;
      }
      case 'photo': {
        const photo = await this.prisma.photo.findUnique({ where: { id: moderationResult.targetId } });
        if (!photo) return null;
        if (decision === 'rejected') {
          await this.prisma.photo.update({ where: { id: moderationResult.targetId }, data: { deletedAt: new Date() } });
        }
        return photo.uploadedBy;
      }
      default:
        return null;
    }
  }

  private decisionTitle(decision: ModerationDecision): string {
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

  private decisionDefaultBody(decision: ModerationDecision): string {
    switch (decision) {
      case 'approved':
        return 'Nội dung bạn gửi đã được kiểm duyệt và duyệt thành công.';
      case 'rejected':
        return 'Nội dung bạn gửi không đáp ứng tiêu chuẩn cộng đồng.';
      case 'edit_requested':
        return 'Vui lòng chỉnh sửa và gửi lại nội dung.';
      default:
        return '';
    }
  }

  private async buildQueueItem(moderationResult: ModerationResult): Promise<AdminModerationQueueItemDto> {
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
        submitterDisplayName = review?.user.profile?.displayName ?? submitterDisplayName;
        relatedReports = await this.reportService.findByTarget('review', moderationResult.targetId);
        break;
      }
      case 'contribution': {
        const contribution = await this.prisma.contribution.findUnique({
          where: { id: moderationResult.targetId },
          include: { user: { include: { profile: true } }, targetRestaurant: true },
        });
        if (contribution) {
          contentKind = contribution.type;
          submitterDisplayName = contribution.user.profile?.displayName ?? submitterDisplayName;
          contentSummary = this.summarizeContribution(contribution);
          if (contribution.targetRestaurantId) {
            relatedReports = await this.reportService.findByTarget('restaurant', contribution.targetRestaurantId);
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
        submitterDisplayName = photo?.uploader?.profile?.displayName ?? submitterDisplayName;
        break;
      }
      case 'video':
        contentSummary = '(Video chưa được hỗ trợ)';
        break;
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
