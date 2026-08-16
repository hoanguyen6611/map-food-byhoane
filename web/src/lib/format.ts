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
