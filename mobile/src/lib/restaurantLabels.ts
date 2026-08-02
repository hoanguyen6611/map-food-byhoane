import type { Ionicons } from '@expo/vector-icons';
import type { FacilityType, RestaurantCategoryCode } from '@foodmap/shared-types';

/** Vietnamese label per `RestaurantCategoryCode` (packages/shared-types/src/restaurant.ts). */
export const CATEGORY_LABELS: Record<RestaurantCategoryCode, string> = {
  quan_an: 'Quán ăn',
  quan_ca_phe: 'Quán cà phê',
  nha_hang: 'Nhà hàng',
  xe_day: 'Xe đẩy',
  quan_via_he: 'Quán vỉa hè',
  quan_bar: 'Quán bar',
};

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Vietnamese label + Ionicons glyph per `FacilityType`. Duplicates
 * FilterScreen's local `FACILITY_LABELS` string values on purpose (kept
 * self-contained here rather than reaching into another screen's private
 * module) but adds the icon each facility row on RestaurantDetailScreen
 * needs that FilterScreen's chip UI doesn't.
 */
export const FACILITY_META: Record<FacilityType, { label: string; icon: IoniconName }> = {
  wifi: { label: 'Wifi', icon: 'wifi-outline' },
  parking_car: { label: 'Đậu ô tô', icon: 'car-outline' },
  parking_motorbike: { label: 'Đậu xe máy', icon: 'bicycle-outline' },
  air_conditioner: { label: 'Máy lạnh', icon: 'snow-outline' },
  outdoor_seating: { label: 'Chỗ ngồi ngoài trời', icon: 'sunny-outline' },
  kid_friendly: { label: 'Thân thiện trẻ em', icon: 'happy-outline' },
  pet_friendly: { label: 'Cho phép thú cưng', icon: 'paw-outline' },
  card_payment: { label: 'Thanh toán thẻ', icon: 'card-outline' },
  private_room: { label: 'Phòng riêng', icon: 'lock-closed-outline' },
};

/** `OpeningHourDto.dayOfWeek` is 0=Sunday..6=Saturday — index directly. */
export const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** e.g. 55000 -> "55.000 ₫". */
export function formatVndFull(amountVnd: number): string {
  return `${amountVnd.toLocaleString('vi-VN')} ₫`;
}
