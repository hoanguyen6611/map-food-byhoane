import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CATEGORY_OPTIONS } from '@/lib/labels';
import { DISTRICTS } from '@/lib/districts';

const SITE_NAME = 'The Food Map of Vietnam';

const ABOUT_SECTIONS = ['cach-cham-diem', 'tieu-chi', 'kiem-duyet', 'du-lieu'] as const;

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
              <svg width="16" height="16" viewBox="0 0 64 64" fill="none" stroke="#fff" strokeLinecap="round">
                <path
                  d="M32 7c-11 0-19.9 8.8-19.9 19.6 0 6.6 4.1 13.1 8.6 18.1 3.6 4 7.4 7.2 9.3 8.7.5.4 1.3.4 1.8 0 1.9-1.5 5.7-4.7 9.3-8.7 4.5-5 8.6-11.5 8.6-18.1C51.9 15.8 43 7 32 7Z"
                  strokeWidth={6}
                />
                <path d="M24 33 40.5 20.5" strokeWidth={5.5} />
                <path d="M24 26 40.5 13.5" strokeWidth={5.5} />
              </svg>
            </span>
            {SITE_NAME}
          </span>
          <p className="footer-brand-desc">{t('siteDescription')}</p>
        </div>

        <div className="footer-col">
          <p className="footer-col-title">{t('footerExploreHeading')}</p>
          <ul>
            {CATEGORY_OPTIONS.map((code) => (
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
