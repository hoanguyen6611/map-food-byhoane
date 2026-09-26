import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCategories, getCuisines, searchRestaurants } from '@/lib/api';
import { PRICE_BUCKETS } from '@/lib/labels';
import { MapPageClient } from '@/components/MapPageClient';
import { MapFilterDrawer } from '@/components/MapFilterDrawer';
import { SearchFilterForm, type SearchParamsRecord } from '@/components/SearchFilterForm';
import { getHomeProvince, HCMC_PROVINCE_NAME, resolveEffectiveProvince } from '@/lib/home-province';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

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

// Same filter set /search's own listing query uses (see SearchFilterForm,
// now shared by both pages) — `q`/`page`/`pageSize` excluded, this function
// owns pagination and the panel's own text box already does client-side
// name filtering over whatever this returns.
interface RestaurantFilters {
  category?: string;
  district?: string;
  province?: string;
  cuisine?: string;
  facilities?: string;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
}

async function fetchAllRestaurants(filters: RestaurantFilters) {
  const first = await searchRestaurants({ ...filters, pageSize: MAX_PAGE_SIZE });
  const totalPages = Math.min(Math.ceil(first.total / MAX_PAGE_SIZE), MAX_PAGES);
  if (totalPages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => searchRestaurants({ ...filters, page: i + 2, pageSize: MAX_PAGE_SIZE })),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
}

export default async function MapPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const effectiveProvince = await resolveEffectiveProvince(search.province);

  const [t, tCommon, tLabels, tFilter, homeProvince, categories, cuisineOptions] = await Promise.all([
    getTranslations('map'),
    getTranslations('common'),
    getTranslations('labels'),
    getTranslations('filterForm'),
    getHomeProvince(),
    getCategories(),
    getCuisines(),
  ]);

  const filters: RestaurantFilters = {
    category: search.category,
    district: search.district,
    province: effectiveProvince,
    cuisine: search.cuisine,
    facilities: search.facilities,
    priceMin: search.priceMin ? Number(search.priceMin) : undefined,
    priceMax: search.priceMax ? Number(search.priceMax) : undefined,
    openNow: search.openNow === 'true',
  };

  const [items, totalCountResult, categoryCounts] = await Promise.all([
    fetchAllRestaurants(filters),
    searchRestaurants({ pageSize: 1, province: effectiveProvince }),
    Promise.all(categories.map((c) => searchRestaurants({ category: c.code, pageSize: 1, province: effectiveProvince }))),
  ]);

  const priceLabels = Object.fromEntries(PRICE_BUCKETS.map((b) => [b.code, tLabels(`priceBucket.${b.code}`)]));

  // How many filter dimensions are active — shown as a badge on the
  // "Bộ lọc" trigger so it's obvious at a glance that the pin list is
  // narrowed, without opening the drawer. `q`/province-override don't count
  // here — the panel's own text box already surfaces `q`, and an explicit
  // province choice isn't really a "filter" in the same sense as the rest.
  const activeFilterCount = [
    search.category,
    search.district,
    search.cuisine,
    search.facilities,
    search.priceMin,
    search.openNow === 'true' ? 'true' : undefined,
  ].filter(Boolean).length;

  return (
    <MapPageClient
      restaurants={items}
      priceLabels={priceLabels}
      filterSlot={
        <MapFilterDrawer key="map-filters" label={tFilter('title')} closeLabel={tCommon('closeMenuAriaLabel')} activeCount={activeFilterCount}>
          <SearchFilterForm
            search={search}
            categoryCounts={categories.map((c, i) => ({ code: c.code, label: c.label, count: categoryCounts[i].total }))}
            cuisineOptions={cuisineOptions}
            totalCount={totalCountResult.total}
            locale={locale}
            isHcmc={effectiveProvince === HCMC_PROVINCE_NAME}
            basePath="/map"
          />
        </MapFilterDrawer>
      }
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
        locating: t('locating'),
        nearMeTitle: t('nearMeTitle'),
        nearMeEmpty: t('nearMeEmpty'),
        backToProvince: t('backToProvince', { province: homeProvince }),
      }}
    />
  );
}
