import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SITE_NAME } from '@/lib/constants';
import { TopBarNav } from './TopBarNav';
import { MapLogoIcon } from './icons';

/** Sticky site header — README's `SiteTopBar`. Composes the existing AuthStatus/LanguageSwitcher (session-fetch/locale-switch logic untouched) via TopBarNav, the client-side piece that owns the mobile menu toggle and its own translations. */
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

        <TopBarNav />
      </div>
    </header>
  );
}
