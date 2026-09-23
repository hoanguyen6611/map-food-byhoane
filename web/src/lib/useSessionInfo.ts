'use client';

import { useEffect, useState } from 'react';
import type { SessionInfo } from '@/app/api/session/route';

/**
 * Shared by AuthStatus (desktop account pill) and TopBarNav (mobile menu
 * panel) — both need the same session snapshot, so this is fetched once by
 * whichever one is the parent and passed down, rather than each fetching
 * `/api/session` independently. `undefined` = still resolving, `null` =
 * signed out. See `api/session/route.ts`'s doc comment for why this is a
 * client-side fetch rather than a server read.
 */
export function useSessionInfo(): SessionInfo | null | undefined {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/session')
      .then((res) => res.json())
      .then((data: SessionInfo | null) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
