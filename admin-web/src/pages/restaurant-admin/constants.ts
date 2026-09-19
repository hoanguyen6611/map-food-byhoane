/**
 * Display labels for the enums used by Admin Restaurant Management
 * (screen 30). Values mirror `@foodmap/shared-types` (`restaurant.ts`) —
 * kept here only for Vietnamese-language display, not as a source of truth
 * for validation.
 *
 * Category, facility, and cuisine used to live here too (CATEGORY_OPTIONS/
 * FACILITY_OPTIONS/CUISINE_OPTIONS) — all three are now real admin-editable
 * tables (Quản lý Danh mục / Quản lý Tiện ích / Quản lý Ẩm thực), so their
 * options come from adminCategoriesApi.list()/adminFacilitiesApi.list()/
 * adminCuisinesApi.list() instead of a hardcoded array here.
 */
import type {
  PriceRangeCode,
  RestaurantPublicationStatus,
} from '@foodmap/shared-types'

export const PRICE_RANGE_OPTIONS: { value: PriceRangeCode; label: string }[] = [
  { value: 'under_50k', label: 'Dưới 50.000đ' },
  { value: '50_100k', label: '50.000đ - 100.000đ' },
  { value: '100_200k', label: '100.000đ - 200.000đ' },
  { value: '200_500k', label: '200.000đ - 500.000đ' },
  { value: 'above_500k', label: 'Trên 500.000đ' },
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
