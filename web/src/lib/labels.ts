// Same Vietnamese label mappings as mobile/src/lib/restaurantLabels.ts —
// duplicated rather than shared, see format.ts's note. Web uses plain emoji
// instead of Ionicons glyphs (no icon-library dependency for a handful of
// facility rows).
import type { FacilityType, RestaurantCategoryCode } from '@foodmap/shared-types';

export const CATEGORY_LABELS: Record<RestaurantCategoryCode, string> = {
  quan_an: 'Quán ăn',
  quan_ca_phe: 'Quán cà phê',
  nha_hang: 'Nhà hàng',
  xe_day: 'Xe đẩy',
  quan_via_he: 'Quán vỉa hè',
  quan_bar: 'Quán bar',
};

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
