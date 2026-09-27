// Category/facility/cuisine labels used to be hardcoded Records here —
// they're all admin-editable tables now (see catalog.controller.ts), so
// every screen reads the live list via useCategories()/useFacilities()/
// useCuisines() instead, or a server-resolved `categoryLabel` field already
// present on restaurant DTOs.

/** `OpeningHourDto.dayOfWeek` is 0=Sunday..6=Saturday — index directly. */
export const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** e.g. 55000 -> "55.000 ₫". */
export function formatVndFull(amountVnd: number): string {
  return `${amountVnd.toLocaleString('vi-VN')} ₫`;
}
