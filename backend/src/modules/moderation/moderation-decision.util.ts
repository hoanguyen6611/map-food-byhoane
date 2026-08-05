import { InternalServerErrorException } from '@nestjs/common';
import type { ModerationDecision, ModerationRecommendedAction, Prisma } from '@prisma/client';
import { MEDIUM_RISK_THRESHOLD } from './rule-based-moderation.util';

export interface ModerationHardRuleInput {
  recommendedAction: ModerationRecommendedAction;
  riskScore: number | Prisma.Decimal;
}

/**
 * Application-level twin of the `moderation_results_hard_rule_chk` DB
 * constraint (see the migration in
 * prisma/migrations/20260803020000_contribution_media_moderation) — throws
 * BEFORE the write, giving callers a clean, actionable error instead of a
 * raw Postgres constraint-violation exception. The DB constraint is the
 * real, unbypassable enforcement; this is defense-in-depth so the common
 * path fails cleanly.
 *
 * recommendedAction=reject or a risk score at/above the medium-risk
 * threshold can never reach decision='approved' without a real moderator
 * (non-null decidedBy) — AI (or a rule-based stand-in) can never self-approve
 * high-risk content.
 */
export function assertDecisionAllowed(
  moderationResult: ModerationHardRuleInput,
  decision: ModerationDecision,
  decidedBy: string | null,
): void {
  if (decision !== 'approved') return;

  const riskScore = Number(moderationResult.riskScore);
  const isHighRisk = moderationResult.recommendedAction === 'reject' || riskScore >= MEDIUM_RISK_THRESHOLD;
  if (isHighRisk && !decidedBy) {
    throw new InternalServerErrorException(
      'Không thể tự động duyệt nội dung có rủi ro cao mà không có người kiểm duyệt.',
    );
  }
}
