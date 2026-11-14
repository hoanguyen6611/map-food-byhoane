'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { SessionInfo } from '@/app/api/session/route';

interface SessionContextValue {
  /** undefined = resolving, null = signed out. `unreadCount` is kept live. */
  session: SessionInfo | null | undefined;
  /** Re-reads the unread count from the server now. */
  refreshUnread: () => void;
  /** Authoritative value from a server render (Notifications page). */
  setUnread: (count: number) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const POLL_MS = 30_000;
const MIN_GAP_MS = 2_000;

/**
 * One `/api/session` fetch for the whole app (previously each consumer —
 * top bar bell, account pill, login prompt — fetched it separately), plus a
 * live unread-notification count. The count re-syncs:
 *  - when a web push arrives (service worker → `fm:push` message),
 *  - on every route change (e.g. after /notifications/open/:id marks one read),
 *  - when the tab becomes visible / regains focus, and every 30s while visible,
 *  - instantly (optimistic −1) when an unread notification is clicked.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const lastFetch = useRef(0);
  const inFlight = useRef(false);
  const signedIn = Boolean(session);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: SessionInfo | null) => !cancelled && setSession(data))
      .catch(() => !cancelled && setSession(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const setUnread = useCallback((count: number) => {
    setSession((s) => (s && s.unreadCount !== count ? { ...s, unreadCount: Math.max(0, count) } : s));
  }, []);

  const refreshUnread = useCallback(
    (force = false) => {
      if (!signedIn || inFlight.current) return;
      const now = Date.now();
      if (!force && now - lastFetch.current < MIN_GAP_MS) return;
      lastFetch.current = now;
      inFlight.current = true;
      fetch('/api/notifications/unread-count', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { unreadCount: number | null } | null) => {
          if (!data) return;
          if (data.unreadCount === null) setSession(null);
          else setUnread(data.unreadCount);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    },
    [signedIn, setUnread],
  );

  // Route changes (skip the very first render — /api/session just answered).
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    refreshUnread();
  }, [pathname, refreshUnread]);

  useEffect(() => {
    if (!signedIn) return;
    const onVisible = () => document.visibilityState === 'visible' && refreshUnread();
    const onPushOrManual = () => refreshUnread(true);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'fm:push') {
        refreshUnread(true);
        window.dispatchEvent(new Event('fm:push'));
      }
    };
    // Optimistic: an unread notification's link was tapped.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-unread-notification]');
      if (!el) return;
      el.removeAttribute('data-unread-notification');
      setSession((s) => (s ? { ...s, unreadCount: Math.max(0, s.unreadCount - 1) } : s));
    };
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refreshUnread(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('fm:unread-refresh', onPushOrManual);
    document.addEventListener('click', onClick, true);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('fm:unread-refresh', onPushOrManual);
      document.removeEventListener('click', onClick, true);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [signedIn, refreshUnread]);

  const forceRefreshUnread = useCallback(() => refreshUnread(true), [refreshUnread]);
  const value = useMemo<SessionContextValue>(
    () => ({ session, refreshUnread: forceRefreshUnread, setUnread }),
    [session, forceRefreshUnread, setUnread],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used within a SessionProvider');
  return ctx;
}
