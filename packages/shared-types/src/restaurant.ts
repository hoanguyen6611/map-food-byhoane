// Mirrors docs/06-database-erd.md §3 (Restaurant Core). Full detail/search
// DTOs are added by build-prompts/03..05 — this module only defines the
// catalog enums seeded in Module 1's migrations.

export type RestaurantCategoryCode =
  | 'quan_an'
  | 'quan_ca_phe'
  | 'nha_hang'
  | 'xe_day'
  | 'quan_via_he'
  | 'quan_bar';

export type CuisineCode =
  | 'mon_viet'
  | 'mon_han'
  | 'mon_nhat'
  | 'mon_chay'
  | 'mon_thai'
  | 'mon_au';

export type PriceRangeCode =
  | 'under_50k'
  | '50_100k'
  | '100_200k'
  | '200_500k'
  | 'above_500k';

export type FacilityType =
  | 'wifi'
  | 'parking_car'
  | 'parking_motorbike'
  | 'air_conditioner'
  | 'outdoor_seating'
  | 'kid_friendly'
  | 'pet_friendly'
  | 'card_payment'
  | 'private_room';

export type RestaurantPublicationStatus =
  | 'pending'
  | 'in_review'
  | 'published'
  | 'rejected'
  | 'hidden'
  | 'removed';

// ---------- build-prompts/03-map-geospatial.md ----------

export interface PriceRangeDto {
  code: PriceRangeCode;
  minVnd: number;
  maxVnd: number | null;
}

// Composite score/reviewCount are honestly null/0 until build-prompts/06-reviews-scoring.md
// computes real values; thumbnailUrl is honestly null until build-prompts/07's MediaModule exists.
export interface RestaurantSummaryDto {
  id: string;
  /** Stable, SEO-friendly identifier — see build-prompts/09-public-web.md's slug-based detail route. */
  slug: string;
  name: string;
  categoryCode: RestaurantCategoryCode;
  thumbnailUrl: string | null;
  compositeScore: number | null;
  reviewCount: number;
  priceRange: PriceRangeDto | null;
  lat: number;
  lng: number;
  /** Meters from the query point. Only present on /restaurants/nearby (a center+radius query has an inherent reference point); omitted on /restaurants/bounds. */
  distanceMeters: number | null;
  isOpenNow: boolean;
}

export interface NearbyRestaurantsQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
}

export interface BoundsRestaurantsQuery {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}
