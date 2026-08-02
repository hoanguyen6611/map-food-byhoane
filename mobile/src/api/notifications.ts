import type { NotificationDto, NotificationListResponse } from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * `NotificationModule` endpoints (docs/build-prompts/08-favorites-notifications-polish.md).
 * Both require auth. There is no real producer yet (Module 7's moderation
 * queue) — see prisma/seed-notifications.ts for how demo rows get created.
 */
export const notificationsApi = {
  list: (params: { page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<NotificationListResponse>(`/me/notifications${qs ? `?${qs}` : ''}`);
  },

  markRead: (id: string) => apiClient.patch<NotificationDto>(`/me/notifications/${id}/read`),
};
