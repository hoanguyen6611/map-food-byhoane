import { getTranslations } from 'next-intl/server';
import type { RestaurantCategoryCode } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { DISTRICTS } from '@/lib/districts';
import { FOOTER_LINKS, SITE_NAME, SOCIAL_LINKS } from '@/lib/constants';
import { MapLogoIcon } from './icons';
import { FooterColumn } from './FooterColumn';
import { MobileFooter, type MobileFooterData } from './MobileFooter';

const ABOUT_SECTIONS = ['cach-cham-diem', 'tieu-chi', 'kiem-duyet', 'du-lieu'] as const;

function aboutHref(section: string): string {
  return section === 'cach-cham-diem' ? '/about' : `/about?section=${section}`;
}

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

  const year = new Date().getFullYear();
  const mobileData: MobileFooterData = {
    siteName: SITE_NAME,
    brandDesc: t('footerBrandDesc'),
    exploreHeading: t('footerExploreHeading'),
    areasHeading: t('footerAreasHeading'),
    aboutHeading: tAbout('footerHeading'),
    explore: [
      ...FOOTER_CATEGORIES.map((code) => ({ href: `/search?category=${code}`, label: tLabels(`category.${code}`) })),
      { href: '/map', label: t('mapNavLink') },
      { href: '/leaderboard', label: t('leaderboardNavLink') },
    ],
    areas: [
      ...DISTRICTS.map((d) => ({ href: `/district/${d.slug}`, label: d.name })),
      { href: '/#khu-vuc', label: t('footerAllAreas') },
    ],
    about: [
      ...[...ABOUT_SECTIONS, 'cap-do-thanh-vien' as const].map((section) => ({ href: aboutHref(section), label: tAbout(`nav.${section}`) })),
      ...(FOOTER_LINKS.contact ? [{ href: FOOTER_LINKS.contact, label: t('footerContact') }] : []),
    ],
    legal: [
      ...(FOOTER_LINKS.terms ? [{ href: FOOTER_LINKS.terms, label: t('footerTerms') }] : []),
      ...(FOOTER_LINKS.privacy ? [{ href: FOOTER_LINKS.privacy, label: t('footerPrivacy') }] : []),
      ...(FOOTER_LINKS.communityGuidelines ? [{ href: FOOTER_LINKS.communityGuidelines, label: t('footerCommunity') }] : []),
    ],
    socials: (['facebook', 'instagram', 'tiktok'] as const)
      .filter((network) => SOCIAL_LINKS[network])
      .map((network) => ({ network, href: SOCIAL_LINKS[network], label: t(`footerSocial.${network}`, { site: SITE_NAME }) })),
    languageLabel: t('languageMenuHeading'),
    copyright: `© ${year} ${SITE_NAME}`,
  };

  return (
    <footer className="site-footer">
      <MobileFooter data={mobileData} />
      <div className="footer-main">
        <div className="footer-brand">
          <span className="topbar-logo" style={{ fontSize: 16 }}>
            <span className="topbar-logo-tile" style={{ width: 28, height: 28, borderRadius: 7 }} aria-hidden="true">
              <MapLogoIcon size={16} style={{ color: '#fff' }} />
            </span>
            {SITE_NAME}
          </span>
          <p className="footer-brand-desc">{t('footerBrandDesc')}</p>
        </div>

        <FooterColumn title={t('footerExploreHeading')}>
          {FOOTER_CATEGORIES.map((code) => (
            <li key={code}>
              <Link href={`/search?category=${code}`}>{tLabels(`category.${code}`)}</Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title={t('footerAreasHeading')}>
          {DISTRICTS.map((district) => (
            <li key={district.slug}>
              <Link href={`/district/${district.slug}`}>{district.name}</Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title={tAbout('footerHeading')}>
          {ABOUT_SECTIONS.map((section) => (
            <li key={section}>
              <Link href={aboutHref(section)}>
                {tAbout(`nav.${section}`)}
              </Link>
            </li>
          ))}
        </FooterColumn>
      </div>
      <div className="footer-bottom">
        © {year} {SITE_NAME}
        {t('footerCta') ? ` — ${t('footerCta')}` : ''}
      </div>
    </footer>
  );
}
