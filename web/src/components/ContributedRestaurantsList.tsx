'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicProfileContributedRestaurantDto } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { placeTileClass } from '@/lib/format';

const INITIAL_VISIBLE_COUNT = 3;

interface Props {
  restaurants: PublicProfileContributedRestaurantDto[];
}

/**
 * Public profile's "Quán đã đóng góp" — a compact list (not a photo-forward
 * grid) so it reads as one rhythm with the reviews list right below it.
 * Only the first few rows show by default; the rest (already fetched —
 * the backend caps this at 12, no separate paginated endpoint) reveal via
 * a local expand toggle rather than a link to a page that doesn't exist.
 */
export function ContributedRestaurantsList({ restaurants }: Props) {
  const t = useTranslations('publicProfile');
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? restaurants : restaurants.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = restaurants.length - INITIAL_VISIBLE_COUNT;

  return (
    <div>
      <div className="contributed-list">
        {visible.map((restaurant) => (
          <Link key={restaurant.id} href={`/restaurant/${restaurant.slug}`} className="contributed-row">
            <span className={`contributed-row-thumb ${restaurant.thumbnailUrl ? '' : placeTileClass(restaurant.id)}`}>
              {restaurant.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
                <img src={restaurant.thumbnailUrl} alt="" />
              ) : null}
            </span>
            <span className="contributed-row-body">
              <span className="contributed-row-name">{restaurant.name}</span>
              <span className="contributed-row-meta">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-star)" stroke="none" aria-hidden="true">
                  <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z" />
                </svg>
                {restaurant.compositeScore !== null ? restaurant.compositeScore.toFixed(1) : '—'} · {restaurant.categoryLabel}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <button type="button" className="contributed-show-more-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('showLess') : t('showMore', { count: hiddenCount })}
        </button>
      ) : null}
    </div>
  );
}
