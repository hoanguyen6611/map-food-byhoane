'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { FilterIcon, ChevronDownIcon } from './icons';

interface Props {
  label: string;
  activeCount: number;
  clearAllHref: string;
  clearAllLabel: string;
  children: React.ReactNode;
}

/**
 * Mobile-only collapse wrapper around /search's filter sections (passed in
 * as `children`, already server-rendered by SearchFilterForm). A thin
 * client-only open/close shell around server content — same pattern
 * MapFilterDrawer already uses for /map's filter modal.
 *
 * An earlier version used a plain `<details>` element with CSS trying to
 * force it permanently "open" on desktop and hand control back to the
 * native toggle on mobile (`display: revert` inside a media query). That
 * fought the browser's own `details:not([open]) > *` hiding behavior in a
 * way that didn't hold up in practice — the content ended up hidden on
 * desktop too. Plain React state sidesteps the whole fight: there's no
 * browser-native hide/show semantics left to override.
 */
export function FilterCollapse({ label, activeCount, clearAllHref, clearAllLabel, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="filter-collapse">
      <div className="filter-collapse-toggle-row">
        <button
          type="button"
          className="filter-collapse-toggle"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          <span className="filter-details-summary-label">
            <FilterIcon size={15} />
            {label}
            {activeCount > 0 ? <span className="filter-details-count">{activeCount}</span> : null}
          </span>
          <ChevronDownIcon
            size={16}
            className={`filter-details-chevron ${isOpen ? 'filter-details-chevron-open' : ''}`}
          />
        </button>
        {/* A sibling of the toggle button, not nested inside it — a <button>
            can't validly contain an <a>, and nesting them would also make a
            tap on "Xoá tất cả" simultaneously toggle the panel open/closed. */}
        <Link href={clearAllHref} className="filter-clear-link filter-collapse-clear-link">
          {clearAllLabel}
        </Link>
      </div>
      <div className={`filter-collapse-content ${isOpen ? 'filter-collapse-content-open' : ''}`}>{children}</div>
    </div>
  );
}
