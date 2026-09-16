import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { PRICE_BUCKETS } from '@/lib/labels';
import { MapPageClient } from '@/components/MapPageClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'map' });
  return { title: t('pageTitle') };
}

// The backend caps `pageSize` at 50 (search-query.dto.ts) — a map view
// needs every pin, so this fetches every page up to a sane safety cap
// (300 restaurants) rather than one oversized request.
const MAX_PAGE_SIZE = 50;
const MAX_PAGES = 6;

async function fetchAllRestaurants() {
  const first = await searchRestaurants({ pageSize: MAX_PAGE_SIZE });
  const totalPages = Math.min(Math.ceil(first.total / MAX_PAGE_SIZE), MAX_PAGES);
  if (totalPages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => searchRestaurants({ page: i + 2, pageSize: MAX_PAGE_SIZE })),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
}

export default async function MapPage() {
  const [t, tCommon, tLabels] = await Promise.all([
    getTranslations('map'),
    getTranslations('common'),
    getTranslations('labels'),
  ]);
  const items = await fetchAllRestaurants();

  const priceLabels = Object.fromEntries(PRICE_BUCKETS.map((b) => [b.code, tLabels(`priceBucket.${b.code}`)]));

  return (
    <MapPageClient
      restaurants={items}
      priceLabels={priceLabels}
      labels={{
        title: t('title'),
        searchPlaceholder: t('searchPlaceholder'),
        layerAll: t('layerAll'),
        layerOpen: t('layerOpen'),
        layerTop: t('layerTop'),
        layerCheap: t('layerCheap'),
        openNow: tCommon('openNow'),
        closedNow: tCommon('closedNow'),
        noRating: tCommon('noRating'),
        viewDetail: t('viewDetail'),
        locateError: t('locateError'),
      }}
    />
  );
}
