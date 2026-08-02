// Contract for docs/build-prompts/04-search-filter.md.
import type { Paginated } from './common';
import type { CuisineCode, FacilityType, RestaurantSummaryDto } from './restaurant';

// Shared by `GET /search` (with `q`) and `GET /restaurants` (browse, no `q`) —
// both endpoints accept the same filter surface per the build-prompt.
export interface SearchFilters {
  /** Search text. Omitted entirely for the `GET /restaurants` browse path. */
  q?: string;
  /** Optional geospatial reference point — required if `distanceKm` is set. */
  lat?: number;
  lng?: number;
  /** Capped server-side at 20km, same as build-prompts/03's nearby endpoint. */
  distanceKm?: number;
  /** VND. Restaurant's price bucket must overlap [priceMin, priceMax]. */
  priceMin?: number;
  priceMax?: number;
  /** 1-5. Excludes restaurants with no composite score yet (honest, not a bug — see build-prompts/06). */
  minRating?: number;
  openNow?: boolean;
  /** Restaurant must have ALL of these facilities. */
  facilities?: FacilityType[];
  /** Restaurant must serve AT LEAST ONE of these cuisines. */
  cuisine?: CuisineCode[];
  page?: number;
  pageSize?: number;
}

export type SearchResultsResponse = Paginated<RestaurantSummaryDto>;
