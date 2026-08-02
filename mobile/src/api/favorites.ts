import type { FavoriteListResponse, FavoriteStatusDto } from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * `FavoriteModule` endpoints (docs/build-prompts/08-favorites-notifications-polish.md).
 * All require auth — `apiClient` attaches the bearer token automatically.
 */
export const favoritesApi = {
  /** `POST /favorites/:restaurantId` — idempotent, 404s if the restaurant doesn't exist. */
  add: (restaurantId: string) => apiClient.post<FavoriteStatusDto>(`/favorites/${restaurantId}`),

  /** `DELETE /favorites/:restaurantId` — idempotent. */
  remove: (restaurantId: string) => apiClient.delete<FavoriteStatusDto>(`/favorites/${restaurantId}`),

  /** `GET /me/favorites` — paginated, restaurant summaries included per row. */
  list: (params: { page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<FavoriteListResponse>(`/me/favorites${qs ? `?${qs}` : ''}`);
  },

  /**
   * `GET /me/favorites/ids` — every favorited restaurant id, unpaginated.
   * The source of truth for "is this restaurant favorited?" checks across
   * Detail/Card/Preview UI (see src/hooks/useFavorites.ts) instead of trusting
   * only the paginated list, which could miss entries past page 1.
   */
  listIds: () => apiClient.get<string[]>('/me/favorites/ids'),
};
