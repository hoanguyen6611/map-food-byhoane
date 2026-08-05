// Same Vietnamese label mappings as mobile/src/lib/restaurantLabels.ts and
// mobile/src/screens/main/FilterScreen.tsx — duplicated rather than shared,
// see format.ts's note. Web uses plain emoji instead of Ionicons glyphs (no
// icon-library dependency for a handful of facility rows).
import type { CuisineCode, FacilityType, PriceRangeCode, RestaurantCategoryCode } from '@foodmap/shared-types';

export const CATEGORY_LABELS: Record<RestaurantCategoryCode, string> = {
  quan_an: 'Quán ăn',
  quan_ca_phe: 'Quán cà phê',
  nha_hang: 'Nhà hàng',
  xe_day: 'Xe đẩy',
  quan_via_he: 'Quán vỉa hè',
  quan_bar: 'Quán bar',
};

export const CUISINE_LABELS: Record<CuisineCode, string> = {
  mon_viet: 'Món Việt',
  mon_han: 'Món Hàn',
  mon_nhat: 'Món Nhật',
  mon_chay: 'Món chay',
  mon_thai: 'Món Thái',
  mon_au: 'Món Âu',
};

export interface PriceBucket {
  code: PriceRangeCode;
  label: string;
  min: number;
  max?: number;
}

// Matches the PriceRangeCode buckets in packages/shared-types/src/restaurant.ts
// and mobile's FilterScreen — a single-select of discrete VND buckets, same
// as mobile, rather than a raw numeric range input.
export const PRICE_BUCKETS: PriceBucket[] = [
  { code: 'under_50k', label: 'Dưới 50k', min: 0, max: 50000 },
  { code: '50_100k', label: '50k - 100k', min: 50000, max: 100000 },
  { code: '100_200k', label: '100k - 200k', min: 100000, max: 200000 },
  { code: '200_500k', label: '200k - 500k', min: 200000, max: 500000 },
  { code: 'above_500k', label: 'Trên 500k', min: 500000, max: undefined },
];

export const FACILITY_META: Record<FacilityType, { label: string; emoji: string }> = {
  wifi: { label: 'Wifi', emoji: '📶' },
  parking_car: { label: 'Đậu ô tô', emoji: '🚗' },
  parking_motorbike: { label: 'Đậu xe máy', emoji: '🏍️' },
  air_conditioner: { label: 'Máy lạnh', emoji: '❄️' },
  outdoor_seating: { label: 'Chỗ ngồi ngoài trời', emoji: '☀️' },
  kid_friendly: { label: 'Thân thiện trẻ em', emoji: '🧒' },
  pet_friendly: { label: 'Cho phép thú cưng', emoji: '🐾' },
  card_payment: { label: 'Thanh toán thẻ', emoji: '💳' },
  private_room: { label: 'Phòng riêng', emoji: '🔒' },
};
