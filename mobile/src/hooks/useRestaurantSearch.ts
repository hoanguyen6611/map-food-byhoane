import { useInfiniteQuery } from '@tanstack/react-query';
import type { SearchResultsResponse } from '@foodmap/shared-types';
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
}

/**
 * Shared paginated-fetch hook backing both SearchResultScreen (`query` set)
 * and ListScreen/Home List (`query` omitted) — both endpoints share the same
 * filter surface (build-prompts/04), so one `useInfiniteQuery` covers both
 * with a manual "load more on scroll end" pagination model.
 */
export function useRestaurantSearch({ query, filters, location, enabled = true }: UseRestaurantSearchParams) {
  return useInfiniteQuery<SearchResultsResponse>({
    queryKey: ['restaurantSearch', query ?? null, filters, location?.latitude, location?.longitude],
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
