import type { ReviewCriteriaCode } from '@foodmap/shared-types';

/**
 * Vietnamese labels for the 7 fixed review criteria — must match
 * `backend/prisma/seed.ts`'s `ReviewCriteria` rows exactly, since these are
 * used client-side (WriteReviewScreen's per-criteria star rows) ahead of
 * fetching any server-provided label (the breakdown response also carries
 * its own `label` per code, used on ReviewsScreen instead of this map).
 */
export const REVIEW_CRITERIA_LABELS: Record<ReviewCriteriaCode, string> = {
  food_quality: 'Chất lượng món ăn',
  space: 'Không gian',
  price: 'Giá cả',
  service: 'Phục vụ',
  hygiene: 'Vệ sinh',
  wifi: 'Wifi',
  parking: 'Chỗ để xe',
};

export const REVIEW_CRITERIA_ORDER: ReviewCriteriaCode[] = [
  'food_quality',
  'space',
  'price',
  'service',
  'hygiene',
  'wifi',
  'parking',
];

/** e.g. 55000 -> "55.000 ₫". Same convention as `restaurantLabels.formatVndFull`. */
export function formatVndFull(amountVnd: number): string {
  return `${amountVnd.toLocaleString('vi-VN')} ₫`;
}

/** Formats an ISO date/datetime string as "dd/MM/yyyy" for review dates. */
export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
