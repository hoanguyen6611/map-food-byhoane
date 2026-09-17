import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SITE_NAME } from '@/lib/constants';
import { AuthStatus } from './AuthStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SearchIcon, MapLogoIcon } from './icons';

/** Sticky site header — README's `SiteTopBar`. Composes the existing AuthStatus/LanguageSwitcher (session-fetch/locale-switch logic untouched). */
export async function SiteTopBar() {
  const t = await getTranslations('common');

  return (
    <header className="site-topbar">
      <div className="container">
        <Link href="/" className="topbar-logo" aria-label={t('homeAriaLabel')}>
          <span className="topbar-logo-tile" aria-hidden="true">
            <MapLogoIcon size={18} style={{ color: '#fff' }} />
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
          <Link href="/search" className="nav-link">
            {t('categoriesNavLink')}
          </Link>
          <Link href="/map" className="nav-link">
            {t('mapNavLink')}
          </Link>
          <span className="topbar-divider" aria-hidden="true" />
          <LanguageSwitcher />
          <AuthStatus />
        </nav>
      </div>
    </header>
  );
}
