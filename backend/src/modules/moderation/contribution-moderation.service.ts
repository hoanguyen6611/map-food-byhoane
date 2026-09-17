import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeGatewayService } from '../ai/claude-gateway.service';
import {
  RAPID_FIRE_THRESHOLD,
  RAPID_FIRE_WINDOW_MS,
} from './rule-based-moderation.util';
import type { ModerationCheckResult } from '../review/review-moderation.service';

export interface ContributionModerationInput {
  userId: string;
  // Caller extracts whatever free-text is relevant for this contribution's
  // type (e.g. a new restaurant's description, a status report's optional
  // notes) — this service doesn't need to know Contribution.payload's
  // per-type shape.
  textContent: string | null;
  // Only present for new_restaurant submissions with a menu — implements
  // the ERD's MenuItem outlier note ("flag abnormal pricing to moderation").
  menuItemPricesVnd?: number[];
}

const ABNORMAL_PRICE_THRESHOLD_VND = 10_000_000;

/**
 * Contribution moderation, backed by the real Claude adapter
 * (ClaudeGatewayService) — the Contribution-side twin of
 * ReviewModerationService. `check()` calls Claude for the text-content risk
 * signal, then layers abnormal-pricing and rapid-fire (both structural
 * signals Claude can't see from text alone) on top — a structural signal
 * can escalate auto_approve → hold_for_review but never downgrades a
 * Claude-flagged 'reject'.
 *
 * Fail-safe lives HERE (same reasoning as ReviewModerationService): a
 * thrown Claude call is caught internally and turned into a synthetic
 * hold_for_review result, so recordResult() always runs and the item is
 * never invisible in the Admin Moderation Queue during a Claude outage.
 * This is also why none of contribution.service.ts's 3 call sites need
 * their own try/catch — check() itself never throws for Claude-related
 * reasons.
 */
@Injectable()
export class ContributionModerationService {
  private readonly logger = new Logger(ContributionModerationService.name);
  readonly modelVersion = 'claude-haiku-4-5-v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeGateway: ClaudeGatewayService,
  ) {}

  async check(
    input: ContributionModerationInput,
  ): Promise<ModerationCheckResult> {
    let base: ModerationCheckResult;
    try {
      base = await this.claudeGateway.moderate({ text: input.textContent });
    } catch (error) {
      this.logger.error(
        `Claude moderation call failed for a contribution, holding for manual review: ${String(error)}`,
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

    if (
      input.menuItemPricesVnd?.some(
        (price) => price >= ABNORMAL_PRICE_THRESHOLD_VND,
      )
    ) {
      labels.push('abnormal_price');
      riskScore = Math.min(1, riskScore + 0.3);
      aiReason += ' Phát hiện mức giá bất thường trong thực đơn.';
      if (recommendedAction === 'auto_approve') {
        recommendedAction = 'hold_for_review';
      }
    }

    const recentCount = await this.prisma.contribution.count({
      where: {
        userId: input.userId,
        createdAt: { gte: new Date(Date.now() - RAPID_FIRE_WINDOW_MS) },
      },
    });
    if (recentCount >= RAPID_FIRE_THRESHOLD) {
      labels.push('rapid_fire');
      riskScore = Math.min(1, riskScore + 0.5);
      aiReason +=
        ' Ngoài ra, tài khoản đang gửi đóng góp với tần suất bất thường.';
      if (recommendedAction === 'auto_approve') {
        recommendedAction = 'hold_for_review';
      }
    }

    return { riskScore, labels, aiReason, recommendedAction };
  }

  /** Returns the created ModerationResult's id, so the caller can link it via Contribution.moderationResultId. */
  async recordResult(
    contributionId: string,
    result: ModerationCheckResult,
  ): Promise<string> {
    const moderationResult = await this.prisma.moderationResult.create({
      data: {
        targetType: 'contribution',
        targetId: contributionId,
        riskScore: new Prisma.Decimal(result.riskScore.toFixed(2)),
        labels: result.labels,
        aiReason: result.aiReason,
        recommendedAction: result.recommendedAction,
        modelVersion: this.modelVersion,
        decision:
          result.recommendedAction === 'auto_approve' ? 'approved' : 'pending',
      },
    });
    return moderationResult.id;
  }
}
