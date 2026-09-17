import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeGatewayService } from '../ai/claude-gateway.service';
import {
  RAPID_FIRE_THRESHOLD,
  RAPID_FIRE_WINDOW_MS,
} from '../moderation/rule-based-moderation.util';

export interface ModerationCheckInput {
  userId: string;
  comment: string | null;
}

export interface ModerationCheckResult {
  riskScore: number;
  labels: string[];
  aiReason: string;
  recommendedAction: 'auto_approve' | 'hold_for_review' | 'reject';
}

/**
 * Review moderation, backed by the real Claude adapter (ClaudeGatewayService,
 * see ai-gateway.interface.ts). `check()` calls Claude for the text-content
 * risk signal, then layers the rapid-fire posting signal on top (a
 * structural DB signal Claude can't see from one piece of text alone) — a
 * structural signal can escalate auto_approve → hold_for_review but never
 * downgrades a Claude-flagged 'reject'.
 *
 * Fail-safe lives HERE, not in the caller: if the Claude call throws
 * (network, timeout, refusal, bad API key), check() catches it and returns
 * a synthetic hold_for_review result instead of throwing — this keeps
 * recordResult() running unconditionally, so a Claude outage still produces
 * a real, queue-visible ModerationResult row instead of a review that's
 * silently held with no moderation record at all.
 */
@Injectable()
export class ReviewModerationService {
  private readonly logger = new Logger(ReviewModerationService.name);
  readonly modelVersion = 'claude-haiku-4-5-v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeGateway: ClaudeGatewayService,
  ) {}

  async check(input: ModerationCheckInput): Promise<ModerationCheckResult> {
    let base: ModerationCheckResult;
    try {
      base = await this.claudeGateway.moderate({ text: input.comment });
    } catch (error) {
      this.logger.error(
        `Claude moderation call failed for a review, holding for manual review: ${String(error)}`,
      );
      return {
        riskScore: 1,
        labels: ['ai_check_failed'],
        aiReason:
          'Kiểm duyệt AI tạm thời không khả dụng — đã chuyển cho người kiểm duyệt.',
        recommendedAction: 'hold_for_review',
      };
    }

    const labels = [...base.labels];
    let riskScore = base.riskScore;
    let aiReason = base.aiReason;
    let recommendedAction = base.recommendedAction;

    const recentCount = await this.prisma.review.count({
      where: {
        userId: input.userId,
        createdAt: { gte: new Date(Date.now() - RAPID_FIRE_WINDOW_MS) },
      },
    });
    if (recentCount >= RAPID_FIRE_THRESHOLD) {
      labels.push('rapid_fire');
      riskScore = Math.min(1, riskScore + 0.5);
      aiReason +=
        ' Ngoài ra, tài khoản đang gửi đánh giá với tần suất bất thường.';
      if (recommendedAction === 'auto_approve') {
        recommendedAction = 'hold_for_review';
      }
    }

    return { riskScore, labels, aiReason, recommendedAction };
  }

  async recordResult(
    targetId: string,
    result: ModerationCheckResult,
  ): Promise<void> {
    await this.prisma.moderationResult.create({
      data: {
        targetType: 'review',
        targetId,
        riskScore: new Prisma.Decimal(result.riskScore.toFixed(2)),
        labels: result.labels,
        aiReason: result.aiReason,
        recommendedAction: result.recommendedAction,
        modelVersion: this.modelVersion,
        // Never self-approves 'reject' or high-risk content — decidedBy
        // stays null here either way (docs/06-database-erd.md §7 hard
        // constraint, enforced independently by moderation-decision.util.ts
        // + the DB CHECK constraint).
        decision:
          result.recommendedAction === 'auto_approve' ? 'approved' : 'pending',
      },
    });
  }
}
