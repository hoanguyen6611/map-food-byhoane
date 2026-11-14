'use client';

import { useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { ChevronDownIcon, FacebookIcon, InstagramIcon, MapLogoIcon, TiktokIcon } from './icons';

export interface FooterLinkItem {
  href: string;
  label: string;
}

export interface MobileFooterData {
  siteName: string;
  brandDesc: string;
  exploreHeading: string;
  areasHeading: string;
  aboutHeading: string;
  explore: FooterLinkItem[];
  areas: FooterLinkItem[];
  about: FooterLinkItem[];
  legal: FooterLinkItem[];
  socials: { network: 'facebook' | 'instagram' | 'tiktok'; href: string; label: string }[];
  languageLabel: string;
  copyright: string;
}

type Variant = 'full' | 'compact' | 'hidden';

// Design: "Dạng đầy đủ" on Home / Giới thiệu / Khu vực / 404, accordion
// ("Dạng gọn") on the other scrolling screens, none on form screens and the
// full-screen map.
const KNOWN_PREFIXES = [
  '/search',
  '/map',
  '/restaurant',
  '/district',
  '/favorites',
  '/collections',
  '/feed',
  '/leaderboard',
  '/notifications',
  '/profile',
  '/add-restaurant',
  '/login',
  '/about',
];

function variantFor(pathname: string): Variant {
  if (pathname === '/login' || pathname === '/add-restaurant' || pathname === '/map' || /^\/restaurant\/[^/]+\/review$/.test(pathname)) {
    return 'hidden';
  }
  if (pathname === '/' || pathname === '/about' || pathname.startsWith('/district/')) return 'full';
  const known = KNOWN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Anything else is the 404 page.
  return known ? 'compact' : 'full';
}

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'en', name: 'English' },
] as const;

const SOCIAL_ICON = { facebook: FacebookIcon, instagram: InstagramIcon, tiktok: TiktokIcon };

function FooterAnchor({ item }: { item: FooterLinkItem }) {
  const external = /^(https?:|mailto:|tel:)/.test(item.href);
  return external ? (
    <a href={item.href} className="mfooter-link" target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
      {item.label}
    </a>
  ) : (
    <Link href={item.href} className="mfooter-link">
      {item.label}
    </Link>
  );
}

function Group({ heading, children, columns = 1 }: { heading: string; children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div className="mfooter-group">
      <div className="mfooter-group-title">{heading}</div>
      <div className={columns === 2 ? 'mfooter-links mfooter-links-2' : 'mfooter-links'}>{children}</div>
    </div>
  );
}

function Accordion({ heading, children }: { heading: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mfooter-acc">
      <button type="button" className="mfooter-acc-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {heading}
        <ChevronDownIcon size={16} className={`mfooter-acc-chevron ${open ? 'mfooter-acc-chevron-open' : ''}`} />
      </button>
      {open ? <div className="mfooter-links mfooter-links-2 mfooter-acc-panel">{children}</div> : null}
    </div>
  );
}

/** Mobile (≤767px) footer — the redesign's "Footer · dùng chung". Desktop keeps SiteFooter's own layout. */
export function MobileFooter({ data }: { data: MobileFooterData }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const variant = variantFor(pathname);

  const links = (items: FooterLinkItem[]) => items.map((item) => <FooterAnchor key={item.href + item.label} item={item} />);

  return (
    <div className="mfooter" data-variant={variant}>
      <div className="mfooter-brand">
        <span className="mfooter-logo">
          <span className="topbar-logo-tile mfooter-logo-tile" aria-hidden="true">
            <MapLogoIcon size={16} style={{ color: '#fff' }} />
          </span>
          {data.siteName}
        </span>
        <p className="mfooter-desc">{data.brandDesc}</p>
        {data.socials.length > 0 ? (
          <div className="mfooter-socials">
            {data.socials.map(({ network, href, label }) => {
              const Icon = SOCIAL_ICON[network];
              return (
                <a key={network} href={href} className="mfooter-social" aria-label={label} target="_blank" rel="noopener noreferrer">
                  <Icon size={16} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        ) : null}
      </div>

      {variant === 'compact' ? (
        <div className="mfooter-accs">
          <Accordion heading={data.exploreHeading}>{links(data.explore)}</Accordion>
          <Accordion heading={data.areasHeading}>{links(data.areas)}</Accordion>
          <Accordion heading={data.aboutHeading}>{links(data.about)}</Accordion>
        </div>
      ) : (
        <>
          <div className="mfooter-cols">
            <Group heading={data.exploreHeading}>{links(data.explore)}</Group>
            <Group heading={data.areasHeading}>{links(data.areas)}</Group>
          </div>
          <Group heading={data.aboutHeading} columns={2}>
            {links(data.about)}
          </Group>
        </>
      )}

      <div className={`mfooter-bottom ${variant === 'compact' ? 'mfooter-bottom-compact' : ''}`}>
        <div className="profile-lang-pill-group mfooter-lang" role="group" aria-label={data.languageLabel}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`profile-lang-pill ${lang.code === locale ? 'profile-lang-pill-active' : ''}`}
              aria-pressed={lang.code === locale}
              onClick={() => lang.code !== locale && router.replace(pathname, { locale: lang.code })}
            >
              {lang.name}
            </button>
          ))}
        </div>
        {data.legal.length > 0 ? (
          <div className="mfooter-legal">
            {data.legal.map((item) => (
              <FooterAnchor key={item.href} item={item} />
            ))}
          </div>
        ) : null}
        <div className="mfooter-copy">{data.copyright}</div>
      </div>
    </div>
  );
}
