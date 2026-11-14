'use client';

import type { SessionInfo } from '@/app/api/session/route';
import { useSessionContext } from '@/components/SessionProvider';

/**
 * Session snapshot shared app-wide by SessionProvider (one /api/session
 * fetch; `unreadCount` kept live). `undefined` = still resolving, `null` =
 * signed out.
 */
export function useSessionInfo(): SessionInfo | null | undefined {
  return useSessionContext().session;
}
