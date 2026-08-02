import { calculateCompositeScore } from './composite-score.util';

// Covers docs/01-prd-mvp.md §10.8's exact acceptance bar and the Definition
// of Done in docs/build-prompts/06-reviews-scoring.md ("Composite score unit
// test (2×5-star vs. 50×4.6-avg comparison) passes").
describe('calculateCompositeScore', () => {
  it('returns null for a restaurant with zero published reviews (never fabricate a score)', () => {
    expect(calculateCompositeScore(0, 0, 4.0)).toBeNull();
  });

  it('a restaurant with 2 five-star reviews scores lower than one with 50 reviews averaging 4.6', () => {
    const globalPriorMean = 4.0;
    const twoFiveStars = calculateCompositeScore(2, 5.0, globalPriorMean)!;
    const fiftyAt46 = calculateCompositeScore(50, 4.6, globalPriorMean)!;
    expect(twoFiveStars).toBeLessThan(fiftyAt46);
  });

  it('damps a low-volume restaurant toward the global prior mean rather than trusting its raw average', () => {
    const globalPriorMean = 3.5;
    const score = calculateCompositeScore(1, 5.0, globalPriorMean)!;
    // With v=1 and m=5, the prior mean dominates (5/6 weight) — the result
    // must sit strictly between the raw average and the prior, not equal
    // either one, and much closer to the prior than to 5.0.
    expect(score).toBeGreaterThan(globalPriorMean);
    expect(score).toBeLessThan(5.0);
    expect(score - globalPriorMean).toBeLessThan(5.0 - score);
  });

  it('converges toward the raw average as review count grows well past the minimum-votes threshold', () => {
    const globalPriorMean = 3.0;
    const rawAverage = 4.8;
    const lowVolume = calculateCompositeScore(3, rawAverage, globalPriorMean)!;
    const highVolume = calculateCompositeScore(500, rawAverage, globalPriorMean)!;
    expect(highVolume).toBeGreaterThan(lowVolume);
    expect(highVolume).toBeCloseTo(rawAverage, 1);
  });

  it('returns exactly the global prior mean when the restaurant average equals it', () => {
    expect(calculateCompositeScore(10, 4.2, 4.2)).toBeCloseTo(4.2, 10);
  });
});
