import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalog';

// Categories change rarely (admin-editable, not a per-session thing) — a
// long staleTime avoids re-fetching the same handful of rows on every screen
// that needs them, same reasoning as web's getCategories 300s ISR window.
const STALE_TIME_MS = 5 * 60 * 1000;

/** Live category catalog (`GET /categories`) — replaces any hardcoded label/list. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.categories,
    staleTime: STALE_TIME_MS,
  });
}
