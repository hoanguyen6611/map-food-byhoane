/**
 * Display labels for the enums used by Admin Restaurant Management
 * (screen 30). Values mirror `@foodmap/shared-types` (`restaurant.ts`) —
 * kept here only for Vietnamese-language display, not as a source of truth
 * for validation.
 */
import type {
  CuisineCode,
  FacilityType,
  PriceRangeCode,
  RestaurantCategoryCode,
  RestaurantPublicationStatus,
} from '@foodmap/shared-types'

export const CATEGORY_OPTIONS: { value: RestaurantCategoryCode; label: string }[] = [
  { value: 'quan_an', label: 'Quán ăn' },
  { value: 'quan_ca_phe', label: 'Quán cà phê' },
  { value: 'nha_hang', label: 'Nhà hàng' },
  { value: 'xe_day', label: 'Xe đẩy' },
  { value: 'quan_via_he', label: 'Quán vỉa hè' },
  { value: 'quan_bar', label: 'Quán bar' },
]

export const PRICE_RANGE_OPTIONS: { value: PriceRangeCode; label: string }[] = [
  { value: 'under_50k', label: 'Dưới 50.000đ' },
  { value: '50_100k', label: '50.000đ - 100.000đ' },
  { value: '100_200k', label: '100.000đ - 200.000đ' },
  { value: '200_500k', label: '200.000đ - 500.000đ' },
  { value: 'above_500k', label: 'Trên 500.000đ' },
]

export const CUISINE_OPTIONS: { value: CuisineCode; label: string }[] = [
  { value: 'mon_viet', label: 'Món Việt' },
  { value: 'mon_han', label: 'Món Hàn' },
  { value: 'mon_nhat', label: 'Món Nhật' },
  { value: 'mon_chay', label: 'Món chay' },
  { value: 'mon_thai', label: 'Món Thái' },
  { value: 'mon_au', label: 'Món Âu' },
]

export const FACILITY_OPTIONS: { value: FacilityType; label: string }[] = [
  { value: 'wifi', label: 'Wifi' },
  { value: 'parking_car', label: 'Chỗ đậu ô tô' },
  { value: 'parking_motorbike', label: 'Chỗ đậu xe máy' },
  { value: 'air_conditioner', label: 'Điều hòa' },
  { value: 'outdoor_seating', label: 'Chỗ ngồi ngoài trời' },
  { value: 'kid_friendly', label: 'Thân thiện trẻ em' },
  { value: 'pet_friendly', label: 'Cho phép thú cưng' },
  { value: 'card_payment', label: 'Thanh toán thẻ' },
  { value: 'private_room', label: 'Phòng riêng' },
]

export const STATUS_OPTIONS: { value: RestaurantPublicationStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'in_review', label: 'Đang xét duyệt' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'hidden', label: 'Đã ẩn' },
  { value: 'removed', label: 'Đã xóa' },
]

export const DAY_LABELS: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ hai',
  2: 'Thứ ba',
  3: 'Thứ tư',
  4: 'Thứ năm',
  5: 'Thứ sáu',
  6: 'Thứ bảy',
}

export function categoryLabel(value: RestaurantCategoryCode): string {
  return CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function statusLabel(value: RestaurantPublicationStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}

export function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`
}
