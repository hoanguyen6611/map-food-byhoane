import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { NotificationDto } from '@foodmap/shared-types'
import { notificationsApi } from '../api/notifications'

const QUERY_KEY = ['admin-notifications']
const POLL_INTERVAL_MS = 30_000

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('vi-VN')
  } catch {
    return value
  }
}

/** Where a `moderation_queue_new` notification's deep link sends an admin. */
function moderationHref(notification: NotificationDto): string {
  const targetType = notification.payload.deepLink.moderationTargetType
  return targetType ? `/moderation?targetType=${targetType}&decision=pending` : '/moderation'
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => notificationsApi.list(),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleItemClick(notification: NotificationDto) {
    setOpen(false)
    if (!notification.isRead) markRead.mutate(notification.id)
    navigate(moderationHref(notification))
  }

  const unreadCount = data?.unreadCount ?? 0

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label="Thông báo"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">Thông báo</div>
          {isError && <p className="notification-dropdown-empty">Không thể tải thông báo.</p>}
          {!isError && data?.items.length === 0 && <p className="notification-dropdown-empty">Chưa có thông báo nào.</p>}
          {!isError &&
            data?.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`notification-item ${notification.isRead ? '' : 'notification-item-unread'}`}
                onClick={() => handleItemClick(notification)}
              >
                <span className="notification-item-title">{notification.payload.title}</span>
                <span className="notification-item-body">{notification.payload.body}</span>
                <span className="notification-item-time">{formatDateTime(notification.createdAt)}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
