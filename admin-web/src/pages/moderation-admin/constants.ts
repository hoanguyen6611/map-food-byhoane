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
}

export function contributionTypeLabel(type: string): string {
  return CONTRIBUTION_TYPE_LABELS[type] ?? type
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
