'use client';

import { useEffect } from 'react';
import { getPushSupport, syncWebPush } from '@/lib/web-push-client';

/**
 * On each full page load, re-sends this browser's existing push
 * subscription (if permission is already granted) so it follows whoever is
 * signed in now — e.g. pushes resume after signing back in, like the app
 * re-registering its token on login. No prompt, no-op when signed out.
 */
export function WebPushSync() {
  useEffect(() => {
    if (getPushSupport() !== 'supported') return;
    const id = window.setTimeout(() => void syncWebPush(), 3000);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
