import type { ModerationCheckResult } from '../review/review-moderation.service';

/**
 * Provider-agnostic AI Gateway contract (docs/05-system-architecture.md §4).
 * NO IMPLEMENTATION OF THIS INTERFACE EXISTS YET — the real Claude adapter
 * is out of scope for this pass (see docs/build-prompts/07's exclusion
 * note). `ReviewModerationService` and `ContributionModerationService` are
 * rule-based stand-ins that satisfy only the *shape* of `moderate()`'s
 * return type (`ModerationCheckResult`), not this `AIGateway` contract
 * itself — they don't implement this interface, and nothing in the app
 * currently depends on it. This file exists so the intended real contract
 * is documented and reviewable now, and so a future Claude adapter has an
 * exact shape to implement against without redesigning callers.
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
   * malicious links, duplicate/copied content, bot-like patterns,
   * irrelevant/violating images, abnormal pricing, fake-restaurant-info
   * signals — docs/01-prd-mvp.md §7). The rule-based stand-ins only cover a
   * small text-heuristic subset of this (URL/spam-phrase/all-caps/repeated-
   * char patterns, rapid-fire posting, abnormal menu pricing) — image
   * content screening in particular has NO stand-in and is the largest gap
   * versus this method's intended scope.
   */
  moderate(content: ModerateContentInput): Promise<ModerationCheckResult>;

  /** Natural-language search query parsing — no callers anywhere in the app yet. */
  parseQuery(text: string, context?: Record<string, unknown>): Promise<StructuredFilter>;

  /** Restaurant AI Summary generation (US-J1/J2) — see ai-summary-trigger.stub.ts, never called yet. */
  summarize(restaurantId: string): Promise<AISummaryResult>;
}
