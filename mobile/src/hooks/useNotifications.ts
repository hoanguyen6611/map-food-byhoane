import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationListResponse } from '@foodmap/shared-types';
import { notificationsApi } from '../api/notifications';

const DEFAULT_PAGE_SIZE = 20;

/** `GET /me/notifications` — paginated, includes `unreadCount` alongside the page's items. */
export function useNotificationsList(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery<NotificationListResponse>({
    queryKey: ['notifications', page, pageSize],
    queryFn: () => notificationsApi.list({ page, pageSize }),
  });
}

/** `PATCH /me/notifications/:id/read` — invalidates every cached notifications page so `unreadCount`/`isRead` stay in sync. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
