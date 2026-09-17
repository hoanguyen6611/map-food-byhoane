/**
 * Typed client for the notification bell — reuses the end-user `/me/notifications`
 * endpoints (backend/src/modules/notification/), which are only guarded by
 * JwtAuthGuard (no role check). Admin-web logs in through the same
 * `/auth/login` JWT issuer, so these work here with zero new backend routes;
 * `NotificationService.notifyAdmins` is what actually writes admin-targeted
 * rows (`moderation_queue_new`).
 */
import type { NotificationDto, NotificationListResponse } from '@foodmap/shared-types'
import { apiClient } from './client'

export const notificationsApi = {
  list: (page = 1, pageSize = 8) =>
    apiClient.get<NotificationListResponse>(`/me/notifications?page=${page}&pageSize=${pageSize}`),
  markRead: (id: string) => apiClient.patch<NotificationDto>(`/me/notifications/${id}/read`),
}
