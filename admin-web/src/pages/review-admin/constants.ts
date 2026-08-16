/**
 * Display labels for Admin Review Management (screen 32). Values mirror
 * `@foodmap/shared-types` (`review.ts`) — kept here only for
 * Vietnamese-language display, not as a source of truth for validation.
 */
import type { ReviewStatus } from '@foodmap/shared-types'

export const STATUS_OPTIONS: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'hidden', label: 'Đã ẩn' },
]

export function statusLabel(value: ReviewStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value
}

// Reuses the same style class as the Moderation Queue's status badge
// (.status-badge-<value> in index.css already covers all 4 ReviewStatus
// values, added for that screen).
export const RISK_SCORE_OPTIONS: { value: number | ''; label: string }[] = [
  { value: '', label: 'Tất cả mức rủi ro' },
  { value: 0.3, label: '≥ 0.30' },
  { value: 0.5, label: '≥ 0.50' },
  { value: 0.7, label: '≥ 0.70' },
]

export function riskScoreLabel(score: number | null): string {
  return score === null ? '—' : score.toFixed(2)
}

export function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}
