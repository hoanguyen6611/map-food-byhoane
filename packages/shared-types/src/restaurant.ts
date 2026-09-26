// Mirrors docs/06-database-erd.md §3 (Restaurant Core). Full detail/search
// DTOs are added by build-prompts/03..05 — this module only defines the
// catalog enums seeded in Module 1's migrations.

// Was a fixed string-literal union — widened to `string` now that
// RestaurantCategory is admin-editable at runtime (see AdminCategory*),
// not just the 6 values seeded at launch. The 6 original codes
// ('quan_an', 'quan_ca_phe', 'nha_hang', 'xe_day', 'quan_via_he',
// 'quan_bar') still exist as real rows — this alias just stops pretending
// they're the only ones that can ever exist.
export type RestaurantCategoryCode = string;

// Was a fixed string-literal union — widened to `string` now that Cuisine
// is admin-editable at runtime (see AdminCuisine*), not just the 6 values
// seeded at launch. The 6 original codes ('mon_viet', 'mon_han', 'mon_nhat',
// 'mon_chay', 'mon_thai', 'mon_au') still exist as real rows — this alias
// just stops pretending they're the only ones that can ever exist. Unlike
// RestaurantCategoryCode/FacilityType, `Cuisine` was already a real table
// (not a Postgres enum) before this widening — only the application-layer
// validation was still pretending it was fixed.
export type CuisineCode = string;

export type PriceRangeCode =
  | 'under_50k'
  | '50_100k'
  | '100_200k'
  | '200_500k'
  | 'above_500k';

// Was a fixed Postgres enum (mirrored here as a string-literal union) —
// widened to `string` now that Facility is a real admin-editable table
// (see AdminFacility*). The original 9 codes ('wifi', 'parking_car', …)
// still exist as seeded rows, same reasoning as RestaurantCategoryCode above.
export type FacilityType = string;

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
// computes real values. thumbnailUrl is the restaurant's first photo (oldest by createdAt) if
// one exists in the photos table, else honestly null — a restaurant with zero photos has no
// thumbnail to show, that's not the same as "media pipeline not built yet" (build-prompts/07
// is the user-facing upload/moderation flow; reading already-seeded photos doesn't need it).
export interface RestaurantSummaryDto {
  id: string;
  /** Stable, SEO-friendly identifier — see build-prompts/09-public-web.md's slug-based detail route. */
  slug: string;
  name: string;
  categoryCode: RestaurantCategoryCode;
  /** RestaurantCategory.label, resolved server-side — category is an
   * admin-editable table now, not a fixed set of codes a client can
   * translate itself, so always display this instead of re-deriving a
   * label from `categoryCode` via a static i18n dictionary. */
  categoryLabel: string;
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

// ---------- Category/Facility catalogs — admin-editable lookup tables,
// exposed publicly (GET /categories, GET /facilities) so web/admin-web can
// build dropdowns/checkboxes from live data instead of a hardcoded list. ----------

export interface CategoryDto {
  id: string;
  code: string;
  label: string;
  icon: string | null;
}

export interface FacilityDto {
  id: string;
  code: string;
  label: string;
  icon: string | null;
  // Always true on the public catalog endpoint (non-public rows are
  // filtered out server-side) — present so admin-web can also render a
  // "Chờ duyệt" badge from this same DTO instead of a parallel admin-only
  // shape.
  isPublic: boolean;
}

export interface CreateCategoryRequest {
  code: string;
  label: string;
  icon?: string;
}

export interface UpdateCategoryRequest {
  label?: string;
  icon?: string;
}

export interface CreateFacilityRequest {
  code: string;
  label: string;
  icon?: string;
}

export interface UpdateFacilityRequest {
  label?: string;
  icon?: string;
  isPublic?: boolean;
}

// No `icon` column on Cuisine (unlike Category/Facility above).
export interface CuisineDto {
  id: string;
  code: string;
  label: string;
  // See FacilityDto.isPublic's doc comment — same reasoning.
  isPublic: boolean;
}

export interface CreateCuisineRequest {
  code: string;
  label: string;
}

export interface UpdateCuisineRequest {
  label?: string;
  isPublic?: boolean;
}
