import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalog';

// Same reasoning/window as useCategories.ts — admin-editable, rarely changes.
const STALE_TIME_MS = 5 * 60 * 1000;

/** Live facility catalog (`GET /facilities`) — replaces any hardcoded label/list. */
export function useFacilities() {
  return useQuery({
    queryKey: ['facilities'],
    queryFn: catalogApi.facilities,
    staleTime: STALE_TIME_MS,
  });
}
