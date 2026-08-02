import type { PriceRangeDto } from '@foodmap/shared-types';

/** e.g. 50000 -> "50k", 800 -> "800đ". */
function formatVnd(amountVnd: number): string {
  if (amountVnd >= 1000) {
    return `${Math.round(amountVnd / 1000)}k`;
  }
  return `${amountVnd}đ`;
}

/** e.g. { minVnd: 50000, maxVnd: 100000 } -> "50k - 100k". Null-safe. */
export function formatPriceRange(range: PriceRangeDto | null): string | null {
  if (!range) {
    return null;
  }
  if (range.maxVnd === null) {
    return `Trên ${formatVnd(range.minVnd)}`;
  }
  if (range.minVnd <= 0) {
    return `Dưới ${formatVnd(range.maxVnd)}`;
  }
  return `${formatVnd(range.minVnd)} - ${formatVnd(range.maxVnd)}`;
}

/** e.g. 850 -> "850 m", 1234 -> "1.2 km". */
export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
