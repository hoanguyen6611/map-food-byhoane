'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSessionInfo } from '@/lib/useSessionInfo';
import { AuthStatus } from './AuthStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { BellIcon } from './icons';

/**
 * Client-side wrapper for the nav below 768px (see globals.css's
 * `.site-topbar .container` breakpoint) — SiteTopBar itself stays a server
 * component (it awaits getTranslations), so the session-dependent bell lives
 * here instead.
 *
 * Below 768px, `.topbar-right` (the desktop nav row/lang switcher/account
 * pill) is hidden entirely — there's no hamburger/overlay substitute for it
 * anymore (removed per the mobile redesign): Bảng tin/Bộ sưu tập live in
 * Profile's own "Khám phá thêm" section now, light/dark + language live in
 * Profile's Settings card, and Bản đồ/Xếp hạng (the only two of these that
 * don't require being logged in) get their own quick-link row on Home
 * instead of a login-gated page, so a logged-out mobile visitor can still
 * reach them. Search/Thêm địa điểm/Yêu thích/Hồ sơ already have their own
 * bottom tab bar entries.
 */
export function TopBarNav() {
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');
  const session = useSessionInfo();

  return (
    <>
      {session ? (
        <Link href="/notifications" className="topbar-mobile-bell" aria-label={tAuth('notificationsLink')}>
          <BellIcon size={20} />
          {session.unreadCount > 0 ? (
            <span className="notification-badge">{session.unreadCount > 99 ? '99+' : session.unreadCount}</span>
          ) : null}
        </Link>
      ) : null}

      <nav aria-label={t('mainNav')} className="topbar-right">
        <Link href="/search" className="nav-link">
          {t('findRestaurants')}
        </Link>
        <Link href="/search" className="nav-link">
          {t('categoriesNavLink')}
        </Link>
        <Link href="/map" className="nav-link">
          {t('mapNavLink')}
        </Link>
        <Link href="/leaderboard" className="nav-link">
          {t('leaderboardNavLink')}
        </Link>
        <span className="topbar-divider" aria-hidden="true" />
        <ThemeToggle />
        <LanguageSwitcher />
        <AuthStatus session={session} />
      </nav>
    </>
  );
}
