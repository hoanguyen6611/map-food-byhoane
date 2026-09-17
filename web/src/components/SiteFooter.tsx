import { getTranslations } from 'next-intl/server';
import type { RestaurantCategoryCode } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { DISTRICTS } from '@/lib/districts';
import { SITE_NAME } from '@/lib/constants';
import { MapLogoIcon } from './icons';

const ABOUT_SECTIONS = ['cach-cham-diem', 'tieu-chi', 'kiem-duyet', 'du-lieu'] as const;

// A curated subset (not the full `CATEGORY_OPTIONS`) — the footer is meant
// as a handful of quick jumping-off points, not an exhaustive category
// index (that's what the Home page's own category grid and /search are for).
const FOOTER_CATEGORIES: RestaurantCategoryCode[] = ['quan_an', 'quan_ca_phe', 'nha_hang', 'quan_bar'];

/** README's `SiteFooter`. */
export async function SiteFooter() {
  const [t, tLabels, tAbout] = await Promise.all([
    getTranslations('common'),
    getTranslations('labels'),
    getTranslations('about'),
  ]);

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <span className="topbar-logo" style={{ fontSize: 14 }}>
            <span className="topbar-logo-tile" style={{ width: 28, height: 28, borderRadius: 7 }} aria-hidden="true">
              <MapLogoIcon size={16} style={{ color: '#fff' }} />
            </span>
            {SITE_NAME}
          </span>
          <p className="footer-brand-desc">{t('footerBrandDesc')}</p>
        </div>

        <div className="footer-col">
          <p className="footer-col-title">{t('footerExploreHeading')}</p>
          <ul>
            {FOOTER_CATEGORIES.map((code) => (
              <li key={code}>
                <Link href={`/search?category=${code}`}>{tLabels(`category.${code}`)}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-col-title">{t('footerAreasHeading')}</p>
          <ul>
            {DISTRICTS.map((district) => (
              <li key={district.slug}>
                <Link href={`/district/${district.slug}`}>{district.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <p className="footer-col-title">{tAbout('footerHeading')}</p>
          <ul>
            {ABOUT_SECTIONS.map((section) => (
              <li key={section}>
                <Link href={section === 'cach-cham-diem' ? '/about' : `/about?section=${section}`}>
                  {tAbout(`nav.${section}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} {SITE_NAME}
        {t('footerCta') ? ` — ${t('footerCta')}` : ''}
      </div>
    </footer>
  );
}
