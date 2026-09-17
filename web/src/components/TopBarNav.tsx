'use client';

import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { AuthStatus } from './AuthStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CloseIcon, MenuIcon } from './icons';

interface Props {
  mainNavLabel: string;
  findRestaurantsLabel: string;
  categoriesLabel: string;
  mapLabel: string;
  menuLabel: string;
  closeMenuLabel: string;
}

/**
 * Client-side wrapper for the nav below 960px (see globals.css's
 * `.site-topbar .container` breakpoint) — SiteTopBar itself stays a server
 * component (it awaits getTranslations), so the toggle state and the
 * close-on-navigate effect live here instead. AuthStatus/LanguageSwitcher
 * were already client components, so importing them directly here (rather
 * than passing them down as children from the server parent) needs no
 * extra wiring.
 */
export function TopBarNav({
  mainNavLabel,
  findRestaurantsLabel,
  categoriesLabel,
  mapLabel,
  menuLabel,
  closeMenuLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="topbar-menu-btn"
        aria-label={open ? closeMenuLabel : menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>
      <nav aria-label={mainNavLabel} className={`topbar-right ${open ? 'topbar-right-open' : ''}`}>
        <Link href="/search" className="nav-link">
          {findRestaurantsLabel}
        </Link>
        <Link href="/search" className="nav-link">
          {categoriesLabel}
        </Link>
        <Link href="/map" className="nav-link">
          {mapLabel}
        </Link>
        <span className="topbar-divider" aria-hidden="true" />
        <LanguageSwitcher />
        <AuthStatus />
      </nav>
    </>
  );
}
