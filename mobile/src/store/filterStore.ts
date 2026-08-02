import { create } from 'zustand';
import type { CuisineCode, FacilityType } from '@foodmap/shared-types';

/**
 * The subset of `SearchFilters` (packages/shared-types/src/search.ts) that is
 * genuinely user-controlled filter state — `q` is search-specific (lives on
 * the SearchResult route param, not here) and `lat`/`lng`/`page`/`pageSize`
 * are supplied per-screen at fetch time, not persisted filter criteria.
 */
export interface FilterValues {
  distanceKm?: number;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  openNow?: boolean;
  facilities: FacilityType[];
  cuisine: CuisineCode[];
}

const DEFAULT_FILTERS: FilterValues = {
  distanceKm: undefined,
  priceMin: undefined,
  priceMax: undefined,
  minRating: undefined,
  openNow: undefined,
  facilities: [],
  cuisine: [],
};

interface FilterState extends FilterValues {
  /** Replaces the entire filter set (FilterScreen's "Áp dụng" action). */
  setFilters: (filters: FilterValues) => void;
  /** Resets to no-filters (FilterScreen's "Xoá bộ lọc" action). */
  clearFilters: () => void;
}

/**
 * Zustand store for the currently-applied search/browse filters, mirroring
 * `src/store/authStore.ts`'s pattern. Deliberately a store rather than
 * component-local state: build-prompts/04's Definition of Done requires
 * filters to survive `SearchResult -> RestaurantDetail (placeholder) -> back`
 * navigation, and no screen in this module resets it on mount/unmount —
 * FilterScreen only *reads* it (to seed local working state) and *writes* it
 * via `setFilters`/`clearFilters`; SearchResultScreen/ListScreen only read it.
 */
export const useFilterStore = create<FilterState>((set) => ({
  ...DEFAULT_FILTERS,
  setFilters: (filters) => set(filters),
  clearFilters: () => set(DEFAULT_FILTERS),
}));

/** Extracts the current filter values (no store actions) from the store. */
export function getFilterValues(state: FilterState): FilterValues {
  return {
    distanceKm: state.distanceKm,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    minRating: state.minRating,
    openNow: state.openNow,
    facilities: state.facilities,
    cuisine: state.cuisine,
  };
}

/** Number of criteria currently applied — drives the "N active filters" badge. */
export function countActiveFilters(filters: FilterValues): number {
  let count = 0;
  if (filters.distanceKm !== undefined) count += 1;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) count += 1;
  if (filters.minRating !== undefined) count += 1;
  if (filters.openNow) count += 1;
  if (filters.facilities.length > 0) count += 1;
  if (filters.cuisine.length > 0) count += 1;
  return count;
}
