import type { RegisterPushTokenDto } from '@foodmap/shared-types';
import { apiClient } from './client';

/** `NotificationModule`'s push-token endpoints — register on permission grant, unregister on logout. */
export const pushTokensApi = {
  register: (dto: RegisterPushTokenDto) => apiClient.post<void>('/me/push-tokens', dto),
  unregister: (token: string) => apiClient.delete<void>(`/me/push-tokens/${encodeURIComponent(token)}`),
};
