import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAiReason, recommendActionForRiskScore, scoreTextContent } from '../moderation/rule-based-moderation.util';

export interface ModerationCheckInput {
  userId: string;
  comment: string | null;
}

export interface ModerationCheckResult {
  riskScore: number;
  labels: string[];
  aiReason: string;
  recommendedAction: 'auto_approve' | 'hold_for_review';
}

const RAPID_FIRE_WINDOW_MS = 60 * 60 * 1000;
const RAPID_FIRE_THRESHOLD = 5;

/**
 * Rule-based stand-in for docs/build-prompts/06-reviews-scoring.md — the
 * real AIGateway.moderate() call arrives in Module 7
 * (docs/build-prompts/07-contribution-media-moderation.md); this module only
 * needs the ModerationResult table + status state-machine wired correctly
 * so Module 7 can swap the scoring implementation without touching callers.
 * The text-heuristic scoring itself now lives in
 * ../moderation/rule-based-moderation.util.ts, shared with
 * ContributionModerationService — this class's own behavior/signature is
 * unchanged by that extraction.
 *
 * // TODO Module 7: replace this method's body with a real AIGateway.moderate() call.
 */
@Injectable()
export class ReviewModerationService {
  readonly modelVersion = 'rule-based-v1';

  constructor(private readonly prisma: PrismaService) {}

  async check(input: ModerationCheckInput): Promise<ModerationCheckResult> {
    const { riskScore: textRiskScore, labels } = scoreTextContent(input.comment);
    let riskScore = textRiskScore;

    const recentCount = await this.prisma.review.count({
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
        // recommendedAction is never 'reject' in this stand-in (see check()) —
        // decision stays 'pending' until Module 7's queue lets a moderator
        // act, or is auto-'approved' here when risk is low. Never
        // self-approves above the hold threshold (docs/06-database-erd.md §7
        // hard constraint: decidedBy stays null either way at this stage).
        decision: result.recommendedAction === 'auto_approve' ? 'approved' : 'pending',
      },
    });
  }
}
