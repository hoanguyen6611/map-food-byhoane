import type { AuditLogEntryDto } from '@foodmap/shared-types'
import { auditActionLabel, auditTargetTypeLabel, formatRelativeOrDateTime } from './constants'

interface Props {
  entries: AuditLogEntryDto[]
}

/**
 * "Hoạt động gần đây" — read-only feed over AuditLogService's already-
 * populated, append-only log (every admin mutation across restaurants/
 * moderation/users has been writing to it all along; this is the first UI
 * that reads it back). Reuses NotificationBell's `.notification-item-*`
 * classes — same "small feed row: title/body/time" shape, just not inside a
 * dropdown here.
 */
export function RecentActivityFeed({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="dashboard-empty">Chưa có hoạt động nào được ghi lại.</p>
  }

  return (
    <div className="notification-dropdown notification-dropdown-static">
      {entries.map((entry) => (
        <div key={entry.id} className="notification-item">
          <span className="notification-item-title">{auditActionLabel(entry.action)}</span>
          <span className="notification-item-body">
            {auditTargetTypeLabel(entry.targetType)} · {entry.actorEmail}
          </span>
          <span className="notification-item-time">{formatRelativeOrDateTime(entry.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
