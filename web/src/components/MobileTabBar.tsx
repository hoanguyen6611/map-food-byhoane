'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { HomeIcon, SearchIcon, PencilIcon, BookmarkIcon, UserIcon } from './icons';

/**
 * Fixed bottom tab bar, mobile-only (see globals.css's `.mobile-tab-bar`
 * 768px breakpoint, matching TopBarNav's own convention) — the redesign's
 * floating icon-only pill (`navDefs`/`tabItems` in "Ngon — App đánh giá món
 * ăn v3.dc.html": home/explore/write/saved/me, each a plain circle, no
 * visible label, active one highlighted by a filled circle behind the
 * icon instead) adapted to this app's existing routes. Labels stay in the
 * DOM via `.sr-only` — the mockup's own icon-only bar has no text
 * equivalent at all, so these aren't from it, just this app's own a11y
 * baseline (every other nav here, including the hamburger overlay, names
 * its destinations for screen readers).
 */
export function MobileTabBar() {
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();

  const items = [
    { href: '/', label: t('home'), Icon: HomeIcon },
    { href: '/search', label: t('findRestaurants'), Icon: SearchIcon },
    { href: '/add-restaurant', label: tAuth('addRestaurantLink'), Icon: PencilIcon },
    { href: '/favorites', label: tAuth('favoritesLink'), Icon: BookmarkIcon },
    { href: '/profile', label: tAuth('profileLink'), Icon: UserIcon },
  ] as const;

  return (
    <nav aria-label={t('mainNav')} className="mobile-tab-bar">
      {items.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`mobile-tab-item ${active ? 'mobile-tab-item-active' : ''}`}>
            <Icon size={22} />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
