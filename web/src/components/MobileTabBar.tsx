'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { HomeIcon, SearchIcon, PencilIcon, BookmarkIcon, UserIcon } from './icons';

/**
 * Fixed bottom tab bar, mobile-only (see globals.css's `.mobile-tab-bar`
 * 768px breakpoint, matching TopBarNav's own convention) — "FoodMap - App
 * mobile.dc.html"'s `navDefs` (home/search/write/saved/me), adapted to this
 * app's existing routes rather than the mockup's single-screen app-state
 * model.
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
            <span className="mobile-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
