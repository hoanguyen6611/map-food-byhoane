/**
 * Display labels for Admin User Management (screen 33). Values mirror
 * `@foodmap/shared-types` (`identity.ts`) — kept here only for
 * Vietnamese-language display, not as a source of truth for validation.
 */
import type { RoleCode, UserStatus } from '@foodmap/shared-types'

export const ROLE_OPTIONS: { value: RoleCode | ''; label: string }[] = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'user', label: 'Người dùng' },
  { value: 'moderator', label: 'Kiểm duyệt viên' },
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'owner', label: 'Chủ quán' },
]

// Assignable via the role-change action — 'guest' isn't a real persisted
// role (unauthenticated visitors only), so it's excluded here even though
// the filter dropdown above lists every RoleCode.
export const ASSIGNABLE_ROLE_OPTIONS: { value: RoleCode; label: string }[] = ROLE_OPTIONS.filter(
  (option): option is { value: RoleCode; label: string } => option.value !== '',
)

export function roleLabel(value: RoleCode): string {
  return ROLE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export const STATUS_OPTIONS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'suspended', label: 'Đã tạm khoá' },
  { value: 'deleted', label: 'Đã xoá' },
]

export function statusLabel(value: UserStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}
