'use client';

import type { ReactNode } from 'react';
import { useSessionInfo } from '@/lib/useSessionInfo';

/**
 * Renders `children` only once the session check confirms the visitor is
 * signed out — nothing while it's still resolving, so a signed-in visitor
 * never sees it flash. A client check (not a server cookie read) so the
 * otherwise-static page using it doesn't become dynamic.
 */
export function LoggedOutOnly({ children }: { children: ReactNode }) {
  const session = useSessionInfo();
  return session === null ? <>{children}</> : null;
}
