// Contract for docs/build-prompts/07-contribution-media-moderation-ai.md's
// AI Summary (US-J1/J2) — read-side only this pass. No real Claude
// summarize() call exists; rows only ever come from
// prisma/seed-ai-summaries.ts until a future module wires up generation
// (see backend/src/modules/ai/ai-summary-trigger.stub.ts).

export interface AISummaryDto {
  summaryText: string;
  pros: string[];
  cons: string[];
  sourceReviewCount: number;
  modelVersion: string;
  generatedAt: string;
}

export interface AISummaryResponseDto {
  // false whenever no AISummary row exists OR the restaurant's CURRENT
  // review count has dropped back below the threshold (a stale row must
  // not be shown just because it happens to still exist).
  available: boolean;
  summary: AISummaryDto | null;
  minReviewThreshold: number;
}
