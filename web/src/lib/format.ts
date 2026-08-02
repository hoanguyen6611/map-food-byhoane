// Same conventions as mobile/src/lib/format.ts and
// mobile/src/lib/reviewLabels.ts — kept as a small duplicate here rather than
// a new shared package, since these are presentation-layer helpers, not
// domain contracts (unlike the DTOs in packages/shared-types).
import type { PriceRangeDto } from '@foodmap/shared-types';

function formatVndShort(amountVnd: number): string {
  if (amountVnd >= 1000) {
    return `${Math.round(amountVnd / 1000)}k`;
  }
  return `${amountVnd}đ`;
}

/** e.g. { minVnd: 50000, maxVnd: 100000 } -> "50k - 100k". Null-safe. */
export function formatPriceRange(range: PriceRangeDto | null): string | null {
  if (!range) return null;
  if (range.maxVnd === null) return `Trên ${formatVndShort(range.minVnd)}`;
  if (range.minVnd <= 0) return `Dưới ${formatVndShort(range.maxVnd)}`;
  return `${formatVndShort(range.minVnd)} - ${formatVndShort(range.maxVnd)}`;
}

/** e.g. 55000 -> "55.000 ₫". */
export function formatVndFull(amountVnd: number): string {
  return `${amountVnd.toLocaleString('vi-VN')} ₫`;
}

const DAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? '';
}
