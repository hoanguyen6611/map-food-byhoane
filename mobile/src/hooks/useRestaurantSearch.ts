import { useInfiniteQuery } from '@tanstack/react-query';
import type { RestaurantCategoryCode, SearchResultsResponse, SearchSort } from '@foodmap/shared-types';
import { searchApi } from '../api/search';
import type { FilterValues } from '../store/filterStore';
import type { LatLng } from '../lib/geo';

const PAGE_SIZE = 20;

interface UseRestaurantSearchParams {
  /** Search text — when provided, hits `GET /search`; when `undefined`, hits `GET /restaurants` (browse, no `q`). */
  query?: string;
  filters: FilterValues;
  location: LatLng | null;
  enabled?: boolean;
  /**
   * Quick top-level category toggle (Home's chip row / Explore's category
   * grid / SearchResult's route param) — takes priority over
   * `filters.category` (the Filter modal's own category chip) when set, so
   * an explicit tap always wins; falls back to whatever's chosen in the
   * Filter modal otherwise.
   */
  category?: RestaurantCategoryCode;
  /** Overrides the default relevance/rating ordering — e.g. Explore's "Xu hướng"/"Mới mở" segments. */
  sort?: SearchSort;
}

/**
 * Shared paginated-fetch hook backing both SearchResultScreen (`query` set)
 * and ListScreen/Home List (`query` omitted) — both endpoints share the same
 * filter surface (build-prompts/04), so one `useInfiniteQuery` covers both
 * with a manual "load more on scroll end" pagination model.
 */
export function useRestaurantSearch({
  query,
  filters,
  location,
  enabled = true,
  category,
  sort,
}: UseRestaurantSearchParams) {
  const effectiveCategory = category ?? filters.category;

  return useInfiniteQuery<SearchResultsResponse>({
    queryKey: [
      'restaurantSearch',
      query ?? null,
      filters,
      location?.latitude,
      location?.longitude,
      effectiveCategory ?? null,
      sort ?? null,
    ],
    queryFn: ({ pageParam }) => {
      const base = {
        lat: location?.latitude,
        lng: location?.longitude,
        distanceKm: filters.distanceKm,
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
        minRating: filters.minRating,
        openNow: filters.openNow,
        facilities: filters.facilities,
        cuisine: filters.cuisine,
        category: effectiveCategory,
        province: filters.province,
        ward: filters.ward,
        sort,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      };
      return query !== undefined ? searchApi.search({ ...base, q: query }) : searchApi.browse(base);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined),
    enabled,
  });
}
