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

/**
 * Vietnamese relative timestamp for NotificationsScreen (build-prompts/08):
 * "Vừa xong" / "5 phút trước" / "3 giờ trước" / "2 ngày trước", falling back
 * to a plain dd/MM/yyyy date once it's more than a week old.
 */
export function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSeconds < 60) return 'Vừa xong';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
