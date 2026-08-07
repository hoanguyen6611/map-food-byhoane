/**
 * Test double for ClaudeGatewayService, used by e2e specs that exercise
 * moderation (review.e2e-spec.ts, contribution.e2e-spec.ts,
 * moderation-queue.e2e-spec.ts) via `.overrideProvider(ClaudeGatewayService)`.
 *
 * This sandbox has no real ANTHROPIC_API_KEY (see backend/env.example) —
 * without this override, every real Claude call fails authentication and
 * ClaudeGatewayService's own fail-safe holds everything for review,
 * regardless of content. That's the correct real-world behavior (proven
 * separately via a live fail-safe smoke test), but it makes these e2e
 * specs' auto-approve assertions unwinnable and erases the distinction
 * their spammy-content fixtures are designed to exercise.
 *
 * This double reconstructs just enough of the pre-Claude rule-based
 * heuristic's URL/spam-phrase detection (same fixture text the specs
 * already use, same label names: 'contains_url'/'spam_phrase') to keep
 * those specs deterministic without a real API key — it is a test fixture,
 * not resurrected production code.
 */
const URL_PATTERN = /https?:\/\/|www\./i;
const SPAM_PHRASES = ['kiếm tiền online', 'quảng cáo', 'click vào link', 'inbox zalo', 'liên hệ zalo'];

export function buildMockClaudeGateway() {
  return {
    moderate: jest.fn(async ({ text }: { text: string | null }) => {
      const content = text ?? '';
      const lower = content.toLowerCase();
      const labels: string[] = [];
      let riskScore = 0;
      if (URL_PATTERN.test(content)) {
        labels.push('contains_url');
        riskScore += 0.4;
      }
      if (SPAM_PHRASES.some((phrase) => lower.includes(phrase))) {
        labels.push('spam_phrase');
        riskScore += 0.3;
      }
      return {
        riskScore,
        labels,
        aiReason:
          labels.length === 0
            ? 'Không phát hiện dấu hiệu bất thường (test double).'
            : `Phát hiện dấu hiệu: ${labels.join(', ')} (test double).`,
        recommendedAction: riskScore >= 0.5 ? 'hold_for_review' : 'auto_approve',
      };
    }),
    // Rejects rather than resolving: CompositeScoreService.recompute() runs
    // on every review creation and can trigger AiSummaryService in the
    // background if a restaurant crosses the review-count threshold mid-test
    // — these specs run against the real dev Postgres (not an ephemeral
    // test DB), so a resolving mock here would persist real AISummary rows
    // for whatever restaurant happened to cross the threshold, including
    // real seeded demo restaurants unrelated to the test. AiSummaryService
    // already swallows this rejection internally (never propagates), so
    // this is a safe no-op from every spec's point of view — no e2e spec
    // asserts anything about AI-summary generation via this trigger path
    // (ai-summary.e2e-spec.ts tests the read side directly via Prisma).
    summarize: jest.fn().mockRejectedValue(new Error('summarize() not exercised by e2e specs')),
    parseQuery: jest.fn(),
  };
}
