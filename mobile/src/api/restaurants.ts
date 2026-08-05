import type { AISummaryResponseDto, RestaurantDetailDto, RestaurantSummaryDto } from '@foodmap/shared-types';
import { apiClient } from './client';
import type { BoundsBox } from '../lib/geo';

/**
 * `RestaurantModule` read endpoints (docs/build-prompts/03-map-geospatial.md).
 * Both are public — no auth required — though `apiClient` attaches a Bearer
 * token automatically when one is present, which is harmless here.
 */
export const restaurantsApi = {
  /**
   * Viewport-based query — the Home Map screen's primary data source, per
   * the architecture doc's viewport caching design. Capped at 200 rows
   * server-side; `distanceMeters` is always `null` in this response.
   */
  bounds: (box: BoundsBox) =>
    apiClient.get<RestaurantSummaryDto[]>(
      `/restaurants/bounds?swLat=${box.swLat}&swLng=${box.swLng}&neLat=${box.neLat}&neLng=${box.neLng}`,
    ),

  /** Center+radius query — not used by Home Map's main loop, kept for future "near me" use cases. */
  nearby: (lat: number, lng: number, radiusKm?: number) =>
    apiClient.get<RestaurantSummaryDto[]>(
      `/restaurants/nearby?lat=${lat}&lng=${lng}${radiusKm !== undefined ? `&radiusKm=${radiusKm}` : ''}`,
    ),

  /**
   * Full restaurant detail (docs/build-prompts/05-restaurant-detail-admin-seed.md).
   * Public — no auth required. 404s if the restaurant doesn't exist or isn't
   * published; `apiClient` surfaces that as a typed `ApiError(404, ...)`.
   */
  detail: (id: string) => apiClient.get<RestaurantDetailDto>(`/restaurants/${id}`),

  /**
   * US-J1/J2 — read-side only (build-prompts/07); `available: false` is a
   * normal, honest response (below-threshold or never generated), not an error.
   */
  aiSummary: (id: string) => apiClient.get<AISummaryResponseDto>(`/restaurants/${id}/ai-summary`),
};
