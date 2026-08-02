import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteListResponse } from '@foodmap/shared-types';
import { favoritesApi } from '../api/favorites';

const FAVORITE_IDS_KEY = ['favoriteIds'] as const;
const DEFAULT_PAGE_SIZE = 20;

/**
 * `GET /me/favorites/ids` as a `Set<string>` for O(1) "is this restaurant
 * favorited?" checks — shared by RestaurantDetailScreen, RestaurantCard
 * (SearchResult/List/Favorites screens) and RestaurantPreviewCard (map). All
 * consumers key off the same `['favoriteIds']` query, so React Query dedupes
 * the network fetch across every screen mounted at once; callers should fetch
 * this ONCE per screen and pass the resulting `isFavorited`/toggle callback
 * down into each card instance rather than each card calling this hook itself.
 */
export function useFavoriteIds() {
  return useQuery({
    queryKey: FAVORITE_IDS_KEY,
    queryFn: favoritesApi.listIds,
    select: (ids) => new Set(ids),
    staleTime: 30_000,
  });
}

/**
 * Toggles a single restaurant's favorite status. Optimistically flips the
 * shared `['favoriteIds']` cache before the network call resolves (per
 * build-prompts/08's explicit optimistic-update requirement), rolling back on
 * error. Callers pass the restaurant's CURRENT favorited state (from
 * `useFavoriteIds()`) so the mutation knows whether to add or remove.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ restaurantId, isFavorited }: { restaurantId: string; isFavorited: boolean }) =>
      isFavorited ? favoritesApi.remove(restaurantId) : favoritesApi.add(restaurantId),

    onMutate: async ({ restaurantId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITE_IDS_KEY });
      const previousIds = queryClient.getQueryData<string[]>(FAVORITE_IDS_KEY);
      queryClient.setQueryData<string[]>(FAVORITE_IDS_KEY, (old = []) =>
        isFavorited ? old.filter((id) => id !== restaurantId) : [...old, restaurantId],
      );
      return { previousIds };
    },

    onError: (_error, _vars, context) => {
      if (context?.previousIds) {
        queryClient.setQueryData(FAVORITE_IDS_KEY, context.previousIds);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITE_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

/** Paginated favorited-restaurant list for the Favorites screen itself. */
export function useFavoritesList(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery<FavoriteListResponse>({
    queryKey: ['favorites', page, pageSize],
    queryFn: () => favoritesApi.list({ page, pageSize }),
  });
}
