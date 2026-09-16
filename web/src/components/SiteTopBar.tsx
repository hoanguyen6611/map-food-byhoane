import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AuthStatus } from './AuthStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SearchIcon } from './icons';

const SITE_NAME = 'The Food Map of Vietnam';

/** Sticky site header — README's `SiteTopBar`. Composes the existing AuthStatus/LanguageSwitcher (session-fetch/locale-switch logic untouched). */
export async function SiteTopBar() {
  const t = await getTranslations('common');

  return (
    <header className="site-topbar">
      <div className="container">
        <Link href="/" className="topbar-logo" aria-label={t('homeAriaLabel')}>
          <span className="topbar-logo-tile" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeLinecap="round">
              <path
                d="M32 7c-11 0-19.9 8.8-19.9 19.6 0 6.6 4.1 13.1 8.6 18.1 3.6 4 7.4 7.2 9.3 8.7.5.4 1.3.4 1.8 0 1.9-1.5 5.7-4.7 9.3-8.7 4.5-5 8.6-11.5 8.6-18.1C51.9 15.8 43 7 32 7Z"
                strokeWidth={6}
              />
              <path d="M24 33 40.5 20.5" strokeWidth={5.5} />
              <path d="M24 26 40.5 13.5" strokeWidth={5.5} />
            </svg>
          </span>
          {SITE_NAME}
        </Link>

        <Link href="/search" className="topbar-search">
          <SearchIcon size={16} />
          {t('searchAriaLabel')}
        </Link>

        <nav aria-label={t('mainNav')} className="topbar-right">
          <Link href="/search" className="nav-link">
            {t('findRestaurants')}
          </Link>
          <Link href="/map" className="nav-link">
            {t('mapNavLink')}
          </Link>
          <Link href="/about" className="nav-link">
            {t('aboutNavLink')}
          </Link>
          <AuthStatus />
          <span className="topbar-divider" aria-hidden="true" />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
