/**
 * Display labels for the Dashboard's "Hoạt động gần đây" feed
 * (RecentActivityFeed.tsx). `action`/`targetType` are free-form strings set
 * at each AuditLogService.record() call site across the admin modules — this
 * is a best-effort label map, not a source of truth; anything not listed
 * falls back to a humanized version of the raw string instead of breaking.
 */

const ACTION_LABELS: Record<string, string> = {
  'restaurant.create': 'Tạo quán mới',
  'restaurant.update': 'Cập nhật quán',
  'restaurant.hide': 'Ẩn quán',
  'restaurant.restore': 'Khôi phục quán',
  'restaurant.delete': 'Xoá quán',
  'restaurant.opening_hours.replace': 'Cập nhật giờ mở cửa',
  'restaurant.opening_hours.notify_failed': 'Gửi thông báo giờ mở cửa thất bại',
  'restaurant.facilities.replace': 'Cập nhật tiện ích',
  'restaurant.menu_item.create': 'Thêm món',
  'restaurant.menu_item.update': 'Cập nhật món',
  'restaurant.menu_item.delete': 'Xoá món',
  'restaurant.photo.attach': 'Thêm ảnh',
  'restaurant.cover_photo.set': 'Đặt ảnh bìa',
  'restaurant.photo.remove': 'Xoá ảnh',
  'user.role_change': 'Đổi vai trò người dùng',
}

const MODERATION_DECISION_LABELS: Record<string, string> = {
  approved: 'Duyệt',
  rejected: 'Từ chối',
  edit_requested: 'Yêu cầu chỉnh sửa',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Nhà hàng',
  review: 'Đánh giá',
  menu_item: 'Món ăn',
  photo: 'Ảnh',
  user: 'Người dùng',
  contribution: 'Đóng góp',
}

function humanize(value: string): string {
  const spaced = value.replace(/[._]/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function auditActionLabel(action: string): string {
  if (action.startsWith('moderation.')) {
    const decision = action.slice('moderation.'.length)
    return `Kiểm duyệt: ${MODERATION_DECISION_LABELS[decision] ?? decision}`
  }
  return ACTION_LABELS[action] ?? humanize(action)
}

export function auditTargetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? humanize(targetType)
}

export function formatRelativeOrDateTime(value: string): string {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return date.toLocaleString('vi-VN')
}
