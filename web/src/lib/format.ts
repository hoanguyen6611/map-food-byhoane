// Locale-aware presentation helpers. `t` params below are always the
// `common` next-intl namespace's translate function (`useTranslations('common')`
// client-side or `getTranslations('common')` server-side).
import type { PriceRangeDto } from '@foodmap/shared-types';

function formatVndShort(amountVnd: number): string {
  if (amountVnd >= 1000) {
    return `${Math.round(amountVnd / 1000)}k`;
  }
  return `${amountVnd}đ`;
}

/** e.g. { minVnd: 50000, maxVnd: 100000 } -> "50k - 100k". Null-safe. */
export function formatPriceRange(range: PriceRangeDto | null, t: (key: string) => string): string | null {
  if (!range) return null;
  if (range.maxVnd === null) return `${t('priceOver')} ${formatVndShort(range.minVnd)}`;
  if (range.minVnd <= 0) return `${t('priceUnder')} ${formatVndShort(range.maxVnd)}`;
  return `${formatVndShort(range.minVnd)} - ${formatVndShort(range.maxVnd)}`;
}

/** e.g. 55000 -> "55.000 ₫" (vi) / "55,000 ₫" (en). */
export function formatVndFull(amountVnd: number, locale: string): string {
  return `${amountVnd.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} ₫`;
}

const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

/** e.g. "2026-09-10T08:00:00Z" -> "2 ngày trước" (vi) / "2 days ago" (en). */
export function formatRelativeDate(iso: string, locale: string): string {
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'vi', { numeric: 'auto' });
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), 'years');
}

const PLACE_TILE_CLASSES = ['place-tile', 'place-tile-1', 'place-tile-2', 'place-tile-3'];

/** Deterministic pastel-gradient tile class (globals.css) for a photo-less place, keyed by id. */
export function placeTileClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PLACE_TILE_CLASSES[Math.abs(hash) % PLACE_TILE_CLASSES.length];
}

/** e.g. "Thảo Vy" -> "TV". Used for monogram avatars. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
