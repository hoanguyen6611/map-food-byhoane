import type {
  AISummaryResponseDto,
  RestaurantCategoryCode,
  RestaurantDetailDto,
  RestaurantSummaryDto,
} from '@foodmap/shared-types';
import { apiClient } from './client';
import type { BoundsBox } from '../lib/geo';

/**
 * Category/cuisine/facilities/area subset of `FilterValues` that
 * `GET /restaurants/bounds` can now narrow server-side — mirrors
 * `SearchFilters`' own fields, minus q/lat-lng-radius/price/minRating/openNow/
 * sort/paging, which don't apply (or stay client-side, see MapScreen).
 */
export interface BoundsFilters {
  category?: RestaurantCategoryCode;
  facilities?: string[];
  cuisine?: string[];
  province?: string;
  ward?: string;
}

function boundsQueryString(box: BoundsBox, filters?: BoundsFilters): string {
  const params = new URLSearchParams();
  params.set('swLat', String(box.swLat));
  params.set('swLng', String(box.swLng));
  params.set('neLat', String(box.neLat));
  params.set('neLng', String(box.neLng));
  if (filters?.category) params.set('category', filters.category);
  if (filters?.facilities && filters.facilities.length > 0) params.set('facilities', filters.facilities.join(','));
  if (filters?.cuisine && filters.cuisine.length > 0) params.set('cuisine', filters.cuisine.join(','));
  if (filters?.province) params.set('province', filters.province);
  if (filters?.ward) params.set('ward', filters.ward);
  return params.toString();
}

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
  bounds: (box: BoundsBox, filters?: BoundsFilters) =>
    apiClient.get<RestaurantSummaryDto[]>(`/restaurants/bounds?${boundsQueryString(box, filters)}`),

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
