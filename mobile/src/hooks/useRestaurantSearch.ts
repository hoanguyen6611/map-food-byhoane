import { useInfiniteQuery } from '@tanstack/react-query';
import type { RestaurantCategoryCode, SearchResultsResponse } from '@foodmap/shared-types';
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
   * grid) — deliberately NOT part of `FilterValues`/`useFilterStore`, since
   * it's a fast single-tap switch rather than a criterion set via the Filter
   * modal's "Áp dụng" flow.
   */
  category?: RestaurantCategoryCode;
}

/**
 * Shared paginated-fetch hook backing both SearchResultScreen (`query` set)
 * and ListScreen/Home List (`query` omitted) — both endpoints share the same
 * filter surface (build-prompts/04), so one `useInfiniteQuery` covers both
 * with a manual "load more on scroll end" pagination model.
 */
export function useRestaurantSearch({ query, filters, location, enabled = true, category }: UseRestaurantSearchParams) {
  return useInfiniteQuery<SearchResultsResponse>({
    queryKey: ['restaurantSearch', query ?? null, filters, location?.latitude, location?.longitude, category ?? null],
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
        category,
        province: filters.province,
        ward: filters.ward,
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
