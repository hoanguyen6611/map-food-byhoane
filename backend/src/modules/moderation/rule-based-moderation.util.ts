// Shared moderation constants/heuristics used by both ReviewModerationService
// and ContributionModerationService (via ClaudeGatewayService).
// MEDIUM_RISK_THRESHOLD/recommendActionForRiskScore are the single source of
// truth for the auto_approve/hold_for_review boundary — both the real Claude
// path and the rule-based fallback below derive recommendedAction from this,
// not from Claude's own judgment, so the boundary always matches the
// hard-rule DB constraint's math exactly (see moderation-decision.util.ts).

export const MEDIUM_RISK_THRESHOLD = 0.5;

// Rapid-fire posting window/threshold — identical in both services; a
// purely structural signal no text-scoring method (Claude or rule-based)
// can see, since it only scores one piece of text at a time. Layered on
// top of the text-content score in each service's check().
export const RAPID_FIRE_WINDOW_MS = 60 * 60 * 1000;
export const RAPID_FIRE_THRESHOLD = 5;

export function recommendActionForRiskScore(
  riskScore: number,
): 'auto_approve' | 'hold_for_review' {
  return riskScore >= MEDIUM_RISK_THRESHOLD
    ? 'hold_for_review'
    : 'auto_approve';
}

const URL_PATTERN = /https?:\/\/|www\./i;
// Spam-indicator phrases (advertising/scam patterns), not a profanity
// wordlist — a portfolio repo is a public artifact, so this favors
// structural spam signals over embedding slurs.
const SPAM_PHRASES = [
  'click vào link',
  'kiếm tiền online',
  'quảng cáo',
  'inbox zalo',
  'liên hệ zalo',
];
const REPEATED_CHAR_PATTERN = /(.)\1{4,}/; // same char 5+ times in a row, e.g. "aaaaa"/"!!!!!"

export interface TextHeuristicResult {
  riskScore: number;
  labels: string[];
  reason: string;
}

/**
 * Free, zero-network fallback for ClaudeGatewayService.moderate() when no
 * ANTHROPIC_API_KEY is configured — the same pattern-matching heuristic
 * this project used before the real Claude adapter existed. Deliberately
 * simple/deterministic (URL/spam-phrase/all-caps/repeated-char patterns),
 * not a substitute for real content understanding — ClaudeGatewayService
 * labels its `reason` output so this path is distinguishable from a real
 * Claude judgment in the Admin Moderation Queue.
 */
export function scoreTextContentRuleBased(
  text: string | null,
): TextHeuristicResult {
  const labels: string[] = [];
  let riskScore = 0;
  const content = text ?? '';

  if (URL_PATTERN.test(content)) {
    labels.push('contains_url');
    riskScore += 0.4;
  }
  const lowerContent = content.toLowerCase();
  if (SPAM_PHRASES.some((phrase) => lowerContent.includes(phrase))) {
    labels.push('spam_phrase');
    riskScore += 0.3;
  }
  const letters = content.replace(/[^\p{L}]/gu, '');
  const upperLetters = content.replace(/[^\p{Lu}]/gu, '');
  if (letters.length > 20 && upperLetters.length / letters.length > 0.7) {
    labels.push('all_caps');
    riskScore += 0.2;
  }
  if (REPEATED_CHAR_PATTERN.test(content)) {
    labels.push('repeated_chars');
    riskScore += 0.2;
  }

  riskScore = Math.min(1, riskScore);
  const reason =
    labels.length === 0
      ? 'Không phát hiện dấu hiệu bất thường (kiểm tra rule-based — chưa cấu hình Claude API).'
      : `Phát hiện dấu hiệu: ${labels.join(', ')} (kiểm tra rule-based — chưa cấu hình Claude API).`;

  return { riskScore, labels, reason };
}
