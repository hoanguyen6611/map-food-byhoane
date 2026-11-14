'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSessionContext } from './SessionProvider';

/**
 * Keeps the Notifications page in step with the live unread count.
 *
 * The page's own numbers/unread dots are server-rendered, and a Back
 * navigation can restore an older render from the router cache. So on every
 * render it asks the server for the real count; whenever the live count and
 * this render's `count` disagree (a notification was read elsewhere, a push
 * arrived, a stale page was restored) it re-renders the page once.
 */
export function UnreadCountSync({ count }: { count: number }) {
  const { session, refreshUnread } = useSessionContext();
  const router = useRouter();
  const live = session?.unreadCount;
  const refreshedFor = useRef<string | null>(null);

  // New/restored render → re-check the truth.
  useEffect(() => {
    refreshUnread();
  }, [count, refreshUnread]);

  useEffect(() => {
    if (live === undefined || live === count) return;
    // Leaving the page (a notification was just tapped → optimistic −1):
    // don't refresh under an in-flight navigation; the next render re-checks.
    if (document.documentElement.dataset.navPending) return;
    const key = `${count}->${live}`;
    if (refreshedFor.current === key) return; // one refresh per mismatch, never a loop
    refreshedFor.current = key;
    router.refresh();
  }, [live, count, router]);

  useEffect(() => {
    const onPush = () => router.refresh();
    window.addEventListener('fm:push', onPush);
    return () => window.removeEventListener('fm:push', onPush);
  }, [router]);

  return null;
}

/** Live unread number (tab chip). Falls back to the server value until the session resolves. */
export function LiveUnreadCount({ fallback }: { fallback: number }) {
  const { session } = useSessionContext();
  return <>{session ? session.unreadCount : fallback}</>;
}

/** Live "N thông báo chưa đọc" / "Bạn đã xem hết thông báo" subtitle. */
export function LiveUnreadSubtitle({ fallback }: { fallback: number }) {
  const { session } = useSessionContext();
  const t = useTranslations('notifications');
  const n = session ? session.unreadCount : fallback;
  return <>{n > 0 ? t('unreadSubtitle', { count: n }) : t('allCaughtUp')}</>;
}
