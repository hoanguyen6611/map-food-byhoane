/**
 * Typed client for the Restaurant Owner self-service endpoints
 * (backend's OwnerRestaurantController, `/owner/restaurants/*`) — scoped
 * to only the restaurant(s) the logged-in `owner`-role user actually owns
 * (enforced server-side by OwnerRestaurantGuard on every route below that
 * carries a restaurant id).
 */
import type {
  OwnerRestaurantDetailDto,
  OwnerRestaurantListItemDto,
  OwnerRestaurantStatsDto,
  PhotoDto,
} from '@foodmap/shared-types'
import { apiClient } from './client'
import type { AttachPhotoBody } from './admin-restaurants'

export const ownerRestaurantsApi = {
  listMine: () => apiClient.get<OwnerRestaurantListItemDto[]>('/owner/restaurants'),

  getDetail: (id: string) => apiClient.get<OwnerRestaurantDetailDto>(`/owner/restaurants/${id}`),

  getStats: (id: string) => apiClient.get<OwnerRestaurantStatsDto>(`/owner/restaurants/${id}/stats`),

  attachPhoto: (id: string, body: AttachPhotoBody) =>
    apiClient.post<PhotoDto>(`/owner/restaurants/${id}/photos`, body),

  attachMenuPhoto: (id: string, body: AttachPhotoBody) =>
    apiClient.post<PhotoDto>(`/owner/restaurants/${id}/menu-photos`, body),

  deletePhoto: (id: string, photoId: string) =>
    apiClient.delete<void>(`/owner/restaurants/${id}/photos/${photoId}`),

  setCoverPhoto: (id: string, photoId: string | null) =>
    apiClient.put<void>(`/owner/restaurants/${id}/cover-photo`, { photoId }),
}
