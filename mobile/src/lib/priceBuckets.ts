import type { PriceRangeCode } from '@foodmap/shared-types';

export interface PriceBucket {
  code: PriceRangeCode;
  label: string;
  min: number;
  max?: number;
}

// Matches the `PriceRangeCode` buckets from packages/shared-types/src/restaurant.ts —
// a single-select chip row is simpler and more correct than a raw numeric
// slider since these buckets are discrete, non-overlapping VND ranges.
// Shared between FilterScreen (full filter form) and MapScreen (quick chip).
export const PRICE_BUCKETS: PriceBucket[] = [
  { code: 'under_50k', label: 'Dưới 50k', min: 0, max: 50000 },
  { code: '50_100k', label: '50k - 100k', min: 50000, max: 100000 },
  { code: '100_200k', label: '100k - 200k', min: 100000, max: 200000 },
  { code: '200_500k', label: '200k - 500k', min: 200000, max: 500000 },
  { code: 'above_500k', label: 'Trên 500k', min: 500000, max: undefined },
];
