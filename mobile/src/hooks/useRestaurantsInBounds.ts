import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '../api/restaurants';
import type { BoundsBox } from '../lib/geo';

/**
 * Viewport-driven restaurant query for the Home Map screen. Keyed by the
 * (already-rounded, see `roundBounds`) bounds box so rapid small pans within
 * the same ~11m cell hit the same React Query cache entry — the backend
 * additionally caches server-side (docs/05-system-architecture.md §8), so no
 * extra client-side caching logic is needed here.
 *
 * `bounds` is `null` until the initial permission/location check resolves;
 * the query stays disabled until then.
 */
export function useRestaurantsInBounds(bounds: BoundsBox | null) {
  return useQuery({
    queryKey: ['restaurants', 'bounds', bounds?.swLat, bounds?.swLng, bounds?.neLat, bounds?.neLng],
    queryFn: () => restaurantsApi.bounds(bounds as BoundsBox),
    enabled: bounds !== null,
    // Keep showing the previous viewport's markers while the new one loads,
    // instead of flashing to an empty map on every pan/zoom.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
