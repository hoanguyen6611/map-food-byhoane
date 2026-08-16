// Enum -> translation-key option lists. Display text itself lives in
// src/i18n/messages/{locale}.json under `labels.*` (see LABEL_MESSAGE_KEY
// helpers below) — this file only enumerates the valid codes, mirroring
// mobile/src/screens/main/FilterScreen.tsx's `_OPTIONS` convention.
import type { CuisineCode, FacilityType, PriceRangeCode, RestaurantCategoryCode } from '@foodmap/shared-types';

export const CATEGORY_OPTIONS: RestaurantCategoryCode[] = [
  'quan_an',
  'quan_ca_phe',
  'nha_hang',
  'xe_day',
  'quan_via_he',
  'quan_bar',
];

export const CUISINE_OPTIONS: CuisineCode[] = ['mon_viet', 'mon_han', 'mon_nhat', 'mon_chay', 'mon_thai', 'mon_au'];

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

// Web uses a plain emoji instead of an icon-library dependency, same as
// before — the emoji itself isn't translated (kept here, not in messages).
export const FACILITY_EMOJI: Record<FacilityType, string> = {
  wifi: '📶',
  parking_car: '🚗',
  parking_motorbike: '🏍️',
  air_conditioner: '❄️',
  outdoor_seating: '☀️',
  kid_friendly: '🧒',
  pet_friendly: '🐾',
  card_payment: '💳',
  private_room: '🔒',
};

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
