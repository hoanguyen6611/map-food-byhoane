// "m" in the Bayesian damping formula — docs/01-prd-mvp.md §10.8's minimum
// votes threshold before a restaurant's raw average is trusted on its own.
export const MIN_VOTES_THRESHOLD = 5;

/**
 * Exact formula from docs/01-prd-mvp.md §10.8 — implement this one, do not
 * invent a different one (per docs/build-prompts/06's explicit instruction):
 *   compositeScore = (v/(v+m))*R + (m/(v+m))*C
 * v = published review count, R = raw average, C = global prior mean.
 * Returns null when v=0 — never fabricate a score for a review-less place.
 */
export function calculateCompositeScore(
  reviewCount: number,
  restaurantAverage: number,
  globalPriorMean: number,
): number | null {
  if (reviewCount <= 0) return null;
  const v = reviewCount;
  const m = MIN_VOTES_THRESHOLD;
  return (v / (v + m)) * restaurantAverage + (m / (v + m)) * globalPriorMean;
}
