/**
 * FUTURE INTEGRATION POINT — not wired to anything yet.
 *
 * Once AiModule has a real AIGateway.summarize() implementation (Claude
 * adapter, see ai-gateway.interface.ts), this is where the trigger goes:
 * called whenever a restaurant's review count crosses
 * AI_SUMMARY_MIN_REVIEW_COUNT for the first time, or every
 * AI_SUMMARY_REFRESH_INTERVAL_DAYS thereafter (the natural call site is
 * CompositeScoreService.recompute(), which already runs on every new
 * published review — or a dedicated BullMQ repeatable job, whichever the
 * future integration prefers).
 *
 * For now this function is intentionally never called by anything —
 * AISummary rows only ever come from prisma/seed-ai-summaries.ts, so the
 * read-side (RestaurantService.getAiSummary / GET /restaurants/:id/ai-summary)
 * has real data to render in dev without a real AI call existing.
 */
export async function triggerSummaryRegeneration(_restaurantId: string): Promise<void> {
  // Deliberately a no-op until the Claude adapter exists.
}
