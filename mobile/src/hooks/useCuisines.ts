import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalog';

// Same reasoning/window as useCategories.ts — admin-editable, rarely changes.
const STALE_TIME_MS = 5 * 60 * 1000;

/** Live cuisine catalog (`GET /cuisines`) — replaces any hardcoded label/list. */
export function useCuisines() {
  return useQuery({
    queryKey: ['cuisines'],
    queryFn: catalogApi.cuisines,
    staleTime: STALE_TIME_MS,
  });
}
