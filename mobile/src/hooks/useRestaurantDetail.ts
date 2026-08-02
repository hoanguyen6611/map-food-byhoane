import { useQuery } from '@tanstack/react-query';
import type { RestaurantDetailDto } from '@foodmap/shared-types';
import { restaurantsApi } from '../api/restaurants';
import { ApiError } from '../api/client';

/**
 * Fetches `GET /restaurants/:id` (build-prompts/05). Shared by
 * RestaurantDetailScreen, PhotoGalleryScreen, and MenuScreen — all three
 * key the query the same way (`['restaurantDetail', restaurantId]`), so
 * React Query dedupes/caches a single in-flight request and serves the
 * other two screens from cache instead of re-fetching.
 */
export function useRestaurantDetail(restaurantId: string) {
  return useQuery<RestaurantDetailDto>({
    queryKey: ['restaurantDetail', restaurantId],
    queryFn: () => restaurantsApi.detail(restaurantId),
    retry: (failureCount, error) => {
      // A 404 (restaurant missing/unpublished) is a stable result, not a
      // transient failure — retrying it just delays showing the "not
      // found" state to the user.
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
