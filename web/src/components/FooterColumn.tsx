'use client';

import { useState } from 'react';
import { ChevronDownIcon } from './icons';

interface Props {
  title: string;
  children: React.ReactNode;
}

/**
 * Mobile-only collapsible footer column (desktop always shows it expanded,
 * no toggle). Same plain-React-state approach as FilterCollapse — see that
 * component's doc comment for why a `<details>`-based version didn't hold
 * up (it ended up hidden on desktop too, not just mobile).
 */
export function FooterColumn({ title, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="footer-col">
      <button
        type="button"
        className="footer-col-title"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        {title}
        <ChevronDownIcon size={14} className={`footer-col-chevron ${isOpen ? 'footer-col-chevron-open' : ''}`} />
      </button>
      <ul className={isOpen ? 'footer-col-list-open' : ''}>{children}</ul>
    </div>
  );
}
