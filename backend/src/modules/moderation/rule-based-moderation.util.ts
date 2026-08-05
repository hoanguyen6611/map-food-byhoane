// Pure heuristics shared by ReviewModerationService (Module 6) and
// ContributionModerationService (Module 7) — both are rule-based stand-ins
// for the real AIGateway.moderate() (see ai-gateway.interface.ts), which is
// out of scope for this pass. Extracted here so contributions don't
// duplicate review's text-screening logic; review's own behavior/signature
// is unchanged by this extraction (see review-moderation.service.ts).

export const MEDIUM_RISK_THRESHOLD = 0.5;

const URL_PATTERN = /https?:\/\/|www\./i;
// Spam-indicator phrases (advertising/scam patterns), not a profanity
// wordlist — a portfolio repo is a public artifact, so this favors
// structural spam signals over embedding slurs.
const SPAM_PHRASES = ['click vào link', 'kiếm tiền online', 'quảng cáo', 'inbox zalo', 'liên hệ zalo'];
const REPEATED_CHAR_PATTERN = /(.)\1{4,}/; // same char 5+ times in a row, e.g. "aaaaa"/"!!!!!"

export interface TextHeuristicResult {
  riskScore: number;
  labels: string[];
}

/** Text-only heuristics — callers add their own target-specific signals (e.g. rapid-fire posting count) on top. */
export function scoreTextContent(text: string | null): TextHeuristicResult {
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

  return { riskScore, labels };
}

export function recommendActionForRiskScore(riskScore: number): 'auto_approve' | 'hold_for_review' {
  return riskScore >= MEDIUM_RISK_THRESHOLD ? 'hold_for_review' : 'auto_approve';
}

export function buildAiReason(labels: string[]): string {
  return labels.length === 0
    ? 'Không phát hiện dấu hiệu bất thường (kiểm tra rule-based).'
    : `Phát hiện dấu hiệu: ${labels.join(', ')} (kiểm tra rule-based).`;
}
