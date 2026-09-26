'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { logoutAction } from '@/app/[locale]/login/actions';
import { useSessionInfo } from '@/lib/useSessionInfo';
import { initialsOf } from '@/lib/format';
import { AuthStatus } from './AuthStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import {
  CloseIcon,
  MenuIcon,
  SearchIcon,
  GridViewIcon,
  MapPinIcon,
  BookmarkIcon,
  BellIcon,
  PlusIcon,
  LogOutIcon,
  ChevronRightIcon,
} from './icons';

/**
 * Client-side wrapper for the nav below 768px (see globals.css's
 * `.site-topbar .container` breakpoint) — SiteTopBar itself stays a server
 * component (it awaits getTranslations), so the toggle state and the
 * close-on-navigate effect live here instead.
 *
 * Below 768px, `.topbar-right` (the desktop nav row/lang switcher/account
 * pill) is hidden entirely — the open menu instead renders as its own
 * full-screen panel (`.mobile-nav-overlay`) with every destination flattened
 * into one scrollable list. This replaces an earlier design where the
 * account dropdown floated as its own absolutely-positioned menu nested
 * inside the (non-full-screen) mobile nav block, which could visually
 * overlap the page content behind it.
 */
export function TopBarNav() {
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const session = useSessionInfo();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Real reload (not router navigation) — same reasoning as AuthStatus's own
  // handleLogout: a Server Action's effect on a soft client-side nav doesn't
  // remount AuthStatus, so it would keep showing "signed in" after logout.
  async function handleLogout() {
    await logoutAction();
    window.location.href = locale === routing.defaultLocale ? '/' : `/${locale}`;
  }

  const displayName = session ? session.displayName || session.email.split('@')[0] : '';

  return (
    <>
      <button
        type="button"
        className="topbar-menu-btn"
        aria-label={open ? t('closeMenuAriaLabel') : t('menuAriaLabel')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>

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
        <span className="topbar-divider" aria-hidden="true" />
        <ThemeToggle />
        <LanguageSwitcher />
        <AuthStatus session={session} />
      </nav>

      {open ? (
        <div className="mobile-nav-overlay" role="dialog" aria-modal="true" aria-label={t('mainNav')}>
          <div className="mobile-nav-scroll">
            {session ? (
              <Link href="/profile" className="mobile-nav-profile-card" onClick={() => setOpen(false)}>
                <span className="account-monogram mobile-nav-avatar" aria-hidden="true">
                  {initialsOf(displayName)}
                </span>
                <span className="mobile-nav-profile-text">
                  <span className="mobile-nav-profile-name">{displayName}</span>
                  <span className="mobile-nav-profile-hint">{tAuth('viewProfileHint')}</span>
                </span>
                <ChevronRightIcon size={16} className="mobile-nav-chevron" />
              </Link>
            ) : null}

            <span className="mobile-nav-section-label">{t('footerExploreHeading')}</span>

            <Link href="/search" className="mobile-nav-row" onClick={() => setOpen(false)}>
              <span className="mobile-nav-row-icon mobile-nav-row-icon-blue">
                <SearchIcon size={17} />
              </span>
              <span className="mobile-nav-row-label">{t('findRestaurants')}</span>
              <ChevronRightIcon size={16} className="mobile-nav-chevron" />
            </Link>
            <Link href="/search" className="mobile-nav-row" onClick={() => setOpen(false)}>
              <span className="mobile-nav-row-icon mobile-nav-row-icon-blue">
                <GridViewIcon size={17} />
              </span>
              <span className="mobile-nav-row-label">{t('categoriesNavLink')}</span>
              <ChevronRightIcon size={16} className="mobile-nav-chevron" />
            </Link>
            <Link href="/map" className="mobile-nav-row" onClick={() => setOpen(false)}>
              <span className="mobile-nav-row-icon mobile-nav-row-icon-blue">
                <MapPinIcon size={17} />
              </span>
              <span className="mobile-nav-row-label">{t('mapNavLink')}</span>
              <ChevronRightIcon size={16} className="mobile-nav-chevron" />
            </Link>

            {session ? (
              <>
                <span className="mobile-nav-divider" />
                <span className="mobile-nav-section-label">{t('accountSectionLabel')}</span>

                <Link href="/favorites" className="mobile-nav-row" onClick={() => setOpen(false)}>
                  <span className="mobile-nav-row-icon mobile-nav-row-icon-magenta">
                    <BookmarkIcon size={17} />
                  </span>
                  <span className="mobile-nav-row-label">{tAuth('favoritesLink')}</span>
                  <ChevronRightIcon size={16} className="mobile-nav-chevron" />
                </Link>

                <Link href="/notifications" className="mobile-nav-row" onClick={() => setOpen(false)}>
                  <span className="mobile-nav-row-icon mobile-nav-row-icon-magenta">
                    <BellIcon size={17} />
                  </span>
                  <span className="mobile-nav-row-label">{tAuth('notificationsLink')}</span>
                  {session.unreadCount > 0 ? (
                    <span className="notification-badge mobile-nav-row-badge">
                      {session.unreadCount > 99 ? '99+' : session.unreadCount}
                    </span>
                  ) : (
                    <ChevronRightIcon size={16} className="mobile-nav-chevron" />
                  )}
                </Link>

                <Link href="/add-restaurant" className="mobile-nav-row" onClick={() => setOpen(false)}>
                  <span className="mobile-nav-row-icon mobile-nav-row-icon-green">
                    <PlusIcon size={17} />
                  </span>
                  <span className="mobile-nav-row-label">{tAuth('addRestaurantLink')}</span>
                  <ChevronRightIcon size={16} className="mobile-nav-chevron" />
                </Link>
              </>
            ) : null}
          </div>

          <div className="mobile-nav-footer">
            <div className="mobile-nav-footer-lang">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            {session === undefined ? null : session ? (
              <button type="button" className="mobile-nav-signout" onClick={handleLogout}>
                <LogOutIcon size={16} />
                {tAuth('signOut')}
              </button>
            ) : (
              <Link href="/login" className="mobile-nav-signout mobile-nav-login" onClick={() => setOpen(false)}>
                {tAuth('title')}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
