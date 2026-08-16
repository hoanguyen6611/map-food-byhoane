import type { SearchFilters, SearchResultsResponse } from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * Builds the query string shared by `GET /search` and `GET /restaurants`
 * (build-prompts/04-search-filter.md — both endpoints accept the same
 * filter surface). Array filters are comma-joined per the API contract
 * (`facilities=wifi,air_conditioner`, not repeated params); `distanceKm` is
 * only included when both `lat`/`lng` are present, since the API 400s on a
 * lone `distanceKm` per the module brief.
 */
function toQueryString(filters: SearchFilters): string {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.lat !== undefined) params.set('lat', String(filters.lat));
  if (filters.lng !== undefined) params.set('lng', String(filters.lng));
  if (filters.distanceKm !== undefined && filters.lat !== undefined && filters.lng !== undefined) {
    params.set('distanceKm', String(filters.distanceKm));
  }
  if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
  if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
  if (filters.openNow) params.set('openNow', 'true');
  if (filters.facilities && filters.facilities.length > 0) params.set('facilities', filters.facilities.join(','));
  if (filters.cuisine && filters.cuisine.length > 0) params.set('cuisine', filters.cuisine.join(','));
  if (filters.category) params.set('category', filters.category);
  if (filters.district) params.set('district', filters.district);
  if (filters.province) params.set('province', filters.province);
  if (filters.ward) params.set('ward', filters.ward);
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));

  return params.toString();
}

/**
 * `SearchModule` read endpoints (docs/build-prompts/04-search-filter.md).
 * Both are public — no auth required — though `apiClient` attaches a Bearer
 * token automatically when one is present, which is harmless here.
 */
export const searchApi = {
  /** `GET /search` — text query + filters, used by SearchResultScreen. */
  search: (filters: SearchFilters) => apiClient.get<SearchResultsResponse>(`/search?${toQueryString(filters)}`),

  /** `GET /restaurants` — browse with filters, no `q`, used by ListScreen (Home List). */
  browse: (filters: Omit<SearchFilters, 'q'>) =>
    apiClient.get<SearchResultsResponse>(`/restaurants?${toQueryString(filters)}`),
};
