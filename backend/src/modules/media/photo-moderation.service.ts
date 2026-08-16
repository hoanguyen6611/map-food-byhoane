import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeGatewayService } from '../ai/claude-gateway.service';
import type { ModerationCheckResult } from '../review/review-moderation.service';

/**
 * Photo moderation — the gap flagged against docs/build-prompts/07: user
 * photo uploads previously went live with zero screening (MediaService.confirm
 * created the Photo row and returned it with no moderation call at all,
 * despite AdminModerationService/AdminModerationQueryDto already having a
 * 'photo' case ready to receive results). Mirrors ReviewModerationService's
 * check()/recordResult() split exactly — same fail-safe-on-error contract, so
 * a Claude outage holds the photo for manual review instead of leaving it
 * unscreened or throwing.
 */
@Injectable()
export class PhotoModerationService {
  private readonly logger = new Logger(PhotoModerationService.name);
  readonly modelVersion = 'claude-haiku-4-5-v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeGateway: ClaudeGatewayService,
  ) {}

  async check(imageUrl: string): Promise<ModerationCheckResult> {
    try {
      return await this.claudeGateway.moderate({ text: null, imageUrls: [imageUrl] });
    } catch (error) {
      this.logger.error(`Claude moderation call failed for a photo, holding for manual review: ${String(error)}`);
      return {
        riskScore: 1,
        labels: ['ai_check_failed'],
        aiReason: 'Kiểm duyệt AI tạm thời không khả dụng — đã chuyển cho người kiểm duyệt.',
        recommendedAction: 'hold_for_review',
      };
    }
  }

  async recordResult(photoId: string, result: ModerationCheckResult): Promise<void> {
    await this.prisma.moderationResult.create({
      data: {
        targetType: 'photo',
        targetId: photoId,
        riskScore: new Prisma.Decimal(result.riskScore.toFixed(2)),
        labels: result.labels,
        aiReason: result.aiReason,
        recommendedAction: result.recommendedAction,
        modelVersion: this.modelVersion,
        decision: result.recommendedAction === 'auto_approve' ? 'approved' : 'pending',
      },
    });
  }
}
