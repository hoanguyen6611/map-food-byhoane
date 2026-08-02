import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

const URL_PATTERN = /https?:\/\/|www\./i;
// Spam-indicator phrases (advertising/scam patterns), not a profanity
// wordlist — a portfolio repo is a public artifact, so this favors
// structural spam signals over embedding slurs. Real content moderation is
// Module 7's AIGateway; this is explicitly a stand-in (see class doc below).
const SPAM_PHRASES = ['click vào link', 'kiếm tiền online', 'quảng cáo', 'inbox zalo', 'liên hệ zalo'];
const REPEATED_CHAR_PATTERN = /(.)\1{4,}/; // same char 5+ times in a row, e.g. "aaaaa"/"!!!!!"
const RAPID_FIRE_WINDOW_MS = 60 * 60 * 1000;
const RAPID_FIRE_THRESHOLD = 5;
const HOLD_FOR_REVIEW_THRESHOLD = 0.5;

/**
 * Rule-based stand-in for docs/build-prompts/06-reviews-scoring.md — the
 * real AIGateway.moderate() call arrives in Module 7
 * (docs/build-prompts/07-contribution-media-moderation.md); this module only
 * needs the ModerationResult table + status state-machine wired correctly
 * so Module 7 can swap the scoring implementation without touching callers.
 *
 * // TODO Module 7: replace this method's body with a real AIGateway.moderate() call.
 */
@Injectable()
export class ReviewModerationService {
  readonly modelVersion = 'rule-based-v1';

  constructor(private readonly prisma: PrismaService) {}

  async check(input: ModerationCheckInput): Promise<ModerationCheckResult> {
    const labels: string[] = [];
    let riskScore = 0;
    const comment = input.comment ?? '';

    if (URL_PATTERN.test(comment)) {
      labels.push('contains_url');
      riskScore += 0.4;
    }
    const lowerComment = comment.toLowerCase();
    if (SPAM_PHRASES.some((phrase) => lowerComment.includes(phrase))) {
      labels.push('spam_phrase');
      riskScore += 0.3;
    }
    const letters = comment.replace(/[^\p{L}]/gu, '');
    const upperLetters = comment.replace(/[^\p{Lu}]/gu, '');
    if (letters.length > 20 && upperLetters.length / letters.length > 0.7) {
      labels.push('all_caps');
      riskScore += 0.2;
    }
    if (REPEATED_CHAR_PATTERN.test(comment)) {
      labels.push('repeated_chars');
      riskScore += 0.2;
    }

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
    const recommendedAction = riskScore >= HOLD_FOR_REVIEW_THRESHOLD ? 'hold_for_review' : 'auto_approve';
    const aiReason =
      labels.length === 0
        ? 'Không phát hiện dấu hiệu bất thường (kiểm tra rule-based).'
        : `Phát hiện dấu hiệu: ${labels.join(', ')} (kiểm tra rule-based).`;

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
