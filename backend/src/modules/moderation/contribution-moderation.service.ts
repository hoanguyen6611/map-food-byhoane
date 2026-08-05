import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAiReason, recommendActionForRiskScore, scoreTextContent } from './rule-based-moderation.util';
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

const RAPID_FIRE_WINDOW_MS = 60 * 60 * 1000;
const RAPID_FIRE_THRESHOLD = 5;
const ABNORMAL_PRICE_THRESHOLD_VND = 10_000_000;

/**
 * Rule-based stand-in for community Contribution moderation — the
 * Contribution-side twin of ReviewModerationService, same shape
 * (check()/recordResult(), modelVersion) and same "never returns 'reject',
 * never self-approves above the medium-risk threshold" behavior. No real
 * AIGateway call here either (excluded from this pass — see
 * ai-gateway.interface.ts).
 */
@Injectable()
export class ContributionModerationService {
  readonly modelVersion = 'rule-based-v1';

  constructor(private readonly prisma: PrismaService) {}

  async check(input: ContributionModerationInput): Promise<ModerationCheckResult> {
    const { riskScore: textRiskScore, labels } = scoreTextContent(input.textContent);
    let riskScore = textRiskScore;

    if (input.menuItemPricesVnd?.some((price) => price >= ABNORMAL_PRICE_THRESHOLD_VND)) {
      labels.push('abnormal_price');
      riskScore += 0.3;
    }

    const recentCount = await this.prisma.contribution.count({
      where: {
        userId: input.userId,
        createdAt: { gte: new Date(Date.now() - RAPID_FIRE_WINDOW_MS) },
      },
    });
    if (recentCount >= RAPID_FIRE_THRESHOLD) {
      labels.push('rapid_fire');
      riskScore += 0.5;
    }

    riskScore = Math.min(1, riskScore);
    const recommendedAction = recommendActionForRiskScore(riskScore);
    const aiReason = buildAiReason(labels);

    return { riskScore, labels, aiReason, recommendedAction };
  }

  /** Returns the created ModerationResult's id, so the caller can link it via Contribution.moderationResultId. */
  async recordResult(contributionId: string, result: ModerationCheckResult): Promise<string> {
    const moderationResult = await this.prisma.moderationResult.create({
      data: {
        targetType: 'contribution',
        targetId: contributionId,
        riskScore: new Prisma.Decimal(result.riskScore.toFixed(2)),
        labels: result.labels,
        aiReason: result.aiReason,
        recommendedAction: result.recommendedAction,
        modelVersion: this.modelVersion,
        decision: result.recommendedAction === 'auto_approve' ? 'approved' : 'pending',
      },
    });
    return moderationResult.id;
  }
}
