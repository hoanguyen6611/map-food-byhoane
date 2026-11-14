'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { StarIcon } from './icons';

export interface TopCategorySection {
  code: string;
  /** Chip label (category name). */
  label: string;
  /** Pre-translated "Top 6 cà phê nên thử". */
  heading: string;
  seeMoreHref: string;
  items: {
    id: string;
    slug: string;
    name: string;
    thumbnailUrl: string | null;
    tileClass: string;
    score: number | null;
    reviewCount: number;
    meta: string | null;
  }[];
}

interface Props {
  sections: TopCategorySection[];
  seeMoreLabel: string;
  noRatingLabel: string;
  chipsLabel: string;
}

/**
 * Mobile Home's single "Top 6 … nên thử" block: category chips switch which
 * ranked list shows (all lists are already server-fetched, so switching is
 * instant — no extra request).
 */
export function HomeTopByCategory({ sections, seeMoreLabel, noRatingLabel, chipsLabel }: Props) {
  const [activeCode, setActiveCode] = useState(sections[0]?.code);
  const active = sections.find((s) => s.code === activeCode) ?? sections[0];
  if (!active) return null;

  return (
    <>
      <div className="section-head">
        <h2 className="section-title">{active.heading}</h2>
        <Link href={active.seeMoreHref} className="section-link">
          {seeMoreLabel}
        </Link>
      </div>
      <div className="home-top-chips" role="group" aria-label={chipsLabel}>
        {sections.map((s) => (
          <button
            key={s.code}
            type="button"
            aria-pressed={s.code === active.code}
            className={`home-top-chip ${s.code === active.code ? 'home-top-chip-active' : ''}`}
            onClick={() => setActiveCode(s.code)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <ol className="home-top-list">
        {active.items.map((r, i) => (
          <li key={r.id}>
            <Link href={`/restaurant/${r.slug}`} className="home-top-row">
              <span className={`home-top-rank home-top-rank-${i + 1}`}>{i + 1}</span>
              <span className={`home-top-thumb ${r.thumbnailUrl ? '' : r.tileClass}`} aria-hidden="true">
                {r.thumbnailUrl ? <Image src={r.thumbnailUrl} alt="" width={44} height={44} sizes="44px" /> : null}
              </span>
              <span className="home-top-body">
                <span className="home-top-name">{r.name}</span>
                <span className="home-top-meta">
                  {r.score !== null ? (
                    <>
                      <StarIcon size={12} filled className="home-top-star" />
                      <span className="home-top-score">{r.score.toFixed(1)}</span>
                      <span>({r.reviewCount})</span>
                    </>
                  ) : (
                    <span>{noRatingLabel}</span>
                  )}
                  {r.meta ? <span>· {r.meta}</span> : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
