'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { logoutAction } from '@/app/[locale]/login/actions';
import { initialsOf } from '@/lib/format';
import type { SessionInfo } from '@/app/api/session/route';
import { BellIcon, UserIcon, BookmarkIcon, PlusIcon, LogOutIcon, ChevronDownIcon } from './icons';

/**
 * Client-fetched (not server-read) on purpose — see `api/session/route.ts`'s
 * doc comment: reading the session cookie directly in the root layout would
 * force every page on this SEO-focused, mostly-static site to render
 * dynamically. This trades a tiny client-side flash (briefly shows "Sign
 * in") for keeping home/search/restaurant-detail statically generated.
 */
export function AuthStatus() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // A real reload (not router navigation) — same reasoning as LoginForm's
  // doc comment: a Server Action's effect on a soft client-side nav doesn't
  // remount this component, so it would keep showing "signed in" after logout.
  async function handleLogout() {
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  if (session === undefined) {
    // Still resolving — render nothing rather than a flash of "sign in".
    return null;
  }

  if (!session) {
    return (
      <Link href="/login" className="topbar-login-cta">
        {t('title')}
      </Link>
    );
  }

  const displayName = session.displayName || session.email.split('@')[0];

  return (
    <span className="auth-status">
      <Link href="/notifications" className="notification-bell-btn" aria-label={t('notificationsLink')}>
        <BellIcon size={19} />
        {session.unreadCount > 0 ? (
          <span className="notification-badge">{session.unreadCount > 99 ? '99+' : session.unreadCount}</span>
        ) : null}
      </Link>

      <div className="account-menu-wrap" ref={menuRef}>
        <button type="button" className="account-pill" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
          <span className="account-monogram" aria-hidden="true">
            {initialsOf(displayName)}
          </span>
          {displayName}
          <ChevronDownIcon size={14} style={{ color: 'var(--color-ink-faint)' }} />
        </button>

        {menuOpen ? (
          <div className="account-menu" role="menu">
            <Link href="/profile" className="account-menu-item" onClick={() => setMenuOpen(false)}>
              <UserIcon size={16} />
              {t('profileLink')}
            </Link>
            <Link href="/favorites" className="account-menu-item" onClick={() => setMenuOpen(false)}>
              <BookmarkIcon size={16} />
              {t('favoritesLink')}
            </Link>
            <Link href="/add-restaurant" className="account-menu-item" onClick={() => setMenuOpen(false)}>
              <PlusIcon size={16} />
              {t('addRestaurantLink')}
            </Link>
            <span className="account-menu-divider" />
            <button type="button" className="account-menu-item" onClick={handleLogout}>
              <LogOutIcon size={16} />
              {t('signOut')}
            </button>
          </div>
        ) : null}
      </div>
    </span>
  );
}
