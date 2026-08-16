import type { ModerationCheckResult } from '../review/review-moderation.service';

/**
 * Provider-agnostic AI Gateway contract (docs/05-system-architecture.md §4),
 * implemented by `ClaudeGatewayService`. `ReviewModerationService`,
 * `ContributionModerationService`, and `PhotoModerationService` each call
 * `moderate()` and layer their own structural signals (rapid-fire posting,
 * abnormal pricing) on top of Claude's text/image risk signal.
 */
export interface ModerateContentInput {
  text: string | null;
  imageUrls?: string[];
}

export interface StructuredFilter {
  cuisine?: string[];
  facilities?: string[];
  priceMin?: number;
  priceMax?: number;
  district?: string;
  openNow?: boolean;
}

export interface AISummaryResult {
  summaryText: string;
  pros: string[];
  cons: string[];
}

export interface AIGateway {
  /**
   * Real content screening (profanity/hate/harassment, disguised ads,
   * malicious links, irrelevant/violating images, abnormal pricing,
   * fake-restaurant-info signals — docs/01-prd-mvp.md §7). `imageUrls`, when
   * present, are fetched and sent as real vision input to Claude (see
   * ClaudeGatewayService.moderate's doc comment) — when no `ANTHROPIC_API_KEY`
   * is configured, text falls back to a rule-based heuristic but images have
   * no equivalent and are held for manual review instead.
   */
  moderate(content: ModerateContentInput): Promise<ModerationCheckResult>;

  /** Natural-language search query parsing — no callers anywhere in the app yet. */
  parseQuery(text: string, context?: Record<string, unknown>): Promise<StructuredFilter>;

  /** Restaurant AI Summary generation (US-J1/J2) — see ai-summary-trigger.stub.ts, never called yet. */
  summarize(restaurantId: string): Promise<AISummaryResult>;
}
