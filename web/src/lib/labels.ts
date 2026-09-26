// Enum -> translation-key option lists. Display text itself lives in
// src/i18n/messages/{locale}.json under `labels.*` (see LABEL_MESSAGE_KEY
// helpers below) — this file only enumerates the valid codes, mirroring
// mobile/src/screens/main/FilterScreen.tsx's `_OPTIONS` convention.
import type { FacilityType, PriceRangeCode, RestaurantCategoryCode } from '@foodmap/shared-types';

// A curated subset of the live /categories list — only used by SiteFooter's
// hand-picked quick links (see its own comment). Everywhere else that shows
// categories (Home's grid, /search's filter + chips, Add Restaurant's
// select) now fetches the live, admin-editable list via getCategories()
// instead, using CategoryDto's own `label`/`icon` fields — see
// packages/shared-types/src/category-icons.ts for the icon side of that.
export const CATEGORY_OPTIONS: RestaurantCategoryCode[] = [
  'quan_an',
  'quan_ca_phe',
  'nha_hang',
  'xe_day',
  'quan_via_he',
  'quan_bar',
];

export const FACILITY_OPTIONS: FacilityType[] = [
  'wifi',
  'parking_car',
  'parking_motorbike',
  'air_conditioner',
  'outdoor_seating',
  'kid_friendly',
  'pet_friendly',
  'card_payment',
  'private_room',
];

// 24x24-viewBox outline icon path data for each facility, matching the
// Claude Design redesign spec (icons.tsx's <Base> wrapper renders these) —
// paths lifted verbatim from the design's prototype `FAC` map. Replaces the
// previous plain-emoji approach; still no icon-library dependency.
export const FACILITY_ICON_PATH: Record<FacilityType, string> = {
  wifi: 'M5 12a10 10 0 0 1 14 0M8 15.5a5.5 5.5 0 0 1 8 0M12 19h.01',
  parking_car: 'M5 16v2M19 16v2M4 16h16v-4l-2-4H6l-2 4zM7.5 13h.01M16.5 13h.01',
  parking_motorbike: 'M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 15h6l-3-6H9M15 9h3',
  air_conditioner: 'M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9',
  outdoor_seating: 'M12 17v4M4 12h16l-8-8-8 8z',
  kid_friendly: 'M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20c0-3.3 3.1-6 7-6s7 2.7 7 6',
  pet_friendly: 'M12 21c-3 0-5-2-5-4s2-3 5-3 5 1 5 3-2 4-5 4zM7 8a1.5 2 0 1 0 0-4 1.5 2 0 0 0 0 4zM17 8a1.5 2 0 1 0 0-4 1.5 2 0 0 0 0 4z',
  card_payment: 'M3 7h18v10H3zM3 11h18',
  private_room: 'M6 11V8a6 6 0 1 1 12 0v3M5 11h14v9H5z',
};

// A user-proposed facility (AddRestaurantForm's "+ Thêm mới") has no entry
// above — this map is a fixed compile-time set, unlike the live-fetched
// facility list itself — so it falls back to a generic tag glyph instead of
// `FacilityIcon` getting `undefined` as its SVG path.
export const DEFAULT_FACILITY_ICON_PATH = 'M4 4h8l8 8-8 8-8-8V4z M8 8h.01';

export interface PriceBucket {
  code: PriceRangeCode;
  min: number;
  max?: number;
}

// Matches the PriceRangeCode buckets in packages/shared-types/src/restaurant.ts
// and mobile's FilterScreen. Display label comes from `labels.priceBucket.*`.
export const PRICE_BUCKETS: PriceBucket[] = [
  { code: 'under_50k', min: 0, max: 50000 },
  { code: '50_100k', min: 50000, max: 100000 },
  { code: '100_200k', min: 100000, max: 200000 },
  { code: '200_500k', min: 200000, max: 500000 },
  { code: 'above_500k', min: 500000, max: undefined },
];
