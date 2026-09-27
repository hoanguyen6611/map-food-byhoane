/**
 * Display labels for the Admin Moderation Queue (screen 31). Values mirror
 * `@foodmap/shared-types` (`moderation.ts`) — kept here only for
 * Vietnamese-language display, not as a source of truth for validation.
 */
import type { ModerationDecision, ModerationTargetType, ReportReason } from '@foodmap/shared-types'

export const TARGET_TYPE_TABS: { value: ModerationTargetType | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'review', label: 'Đánh giá' },
  { value: 'contribution', label: 'Đóng góp' },
  { value: 'photo', label: 'Ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'restaurant', label: 'Nhà hàng bị báo cáo' },
]

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam/quảng cáo',
  inappropriate: 'Nội dung không phù hợp',
  incorrect_info: 'Thông tin sai',
  duplicate: 'Trùng lặp',
  closed_down: 'Quán đã đóng cửa',
  other: 'Khác',
}

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASON_LABELS[reason] ?? reason
}

export const DECISION_OPTIONS: { value: ModerationDecision | ''; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'edit_requested', label: 'Yêu cầu chỉnh sửa' },
  { value: '', label: 'Tất cả trạng thái' },
]

export function decisionLabel(value: ModerationDecision): string {
  return DECISION_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}

export function riskScoreLabel(score: number): string {
  return score.toFixed(2)
}

const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  new_restaurant: 'Quán mới',
  edit_suggestion: 'Đề xuất chỉnh sửa',
  status_update: 'Cập nhật trạng thái',
  closure_report: 'Báo cáo đóng cửa',
  owner_claim: 'Yêu cầu làm chủ quán',
}

export function contributionTypeLabel(type: string): string {
  return CONTRIBUTION_TYPE_LABELS[type] ?? type
}

// edit_suggestion's `fieldName` is the raw EditableRestaurantField code
// (e.g. "address.line", "openingHours") — this is what a moderator actually
// reads, not what the payload happens to be keyed by.
const FIELD_NAME_LABELS: Record<string, string> = {
  name: 'Tên quán',
  description: 'Mô tả',
  phone: 'Số điện thoại',
  'address.line': 'Địa chỉ (số nhà, đường)',
  'address.ward': 'Phường/Xã',
  'address.district': 'Quận/Huyện',
  'address.province': 'Tỉnh/Thành phố',
  location: 'Toạ độ (vĩ độ, kinh độ)',
  openingHours: 'Giờ mở cửa',
  facilities: 'Tiện ích',
  facebookUrl: 'Facebook',
  instagramUrl: 'Instagram',
  tiktokUrl: 'TikTok',
  websiteUrl: 'Website',
}

export function fieldNameLabel(fieldName: string): string {
  return FIELD_NAME_LABELS[fieldName] ?? fieldName
}

export const DAY_LABELS: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ hai',
  2: 'Thứ ba',
  3: 'Thứ tư',
  4: 'Thứ năm',
  5: 'Thứ sáu',
  6: 'Thứ bảy',
}
