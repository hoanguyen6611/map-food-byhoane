'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useFavorites } from './FavoritesProvider';
import { CloseIcon, StarIcon } from './icons';

interface Props {
  restaurantId: string;
  slug: string;
  name: string;
  /** Pre-formatted "Quận 3 · 50–100k đ" line (category omitted until the favorites API returns its label). */
  meta: string;
  thumbnailUrl: string | null;
  tileClass: string;
  score: number | null;
  reviewCount: number;
  noRatingLabel: string;
  removeLabel: string;
  reviewLabel: string;
}

/**
 * Saved-screen row from the mobile redesign: thumb · name/meta/score ·
 * remove (X) + "Đánh giá" shortcut. Removing un-saves through the shared
 * FavoritesProvider and hides the row optimistically.
 */
export function SavedRow(props: Props) {
  const { favoriteIds, isLoaded, toggle } = useFavorites();
  // Hide only rows the user removed here — not every row whose id is missing
  // from the provider (that set is empty if its initial fetch failed). A
  // failed DELETE rolls the id back into the set, which re-shows the row.
  const [removed, setRemoved] = useState(false);
  if (removed && !favoriteIds.has(props.restaurantId)) {
    return null;
  }
  const href = `/restaurant/${props.slug}`;

  return (
    <div className="saved-row">
      <Link href={href} className={`saved-row-thumb ${props.thumbnailUrl ? '' : props.tileClass}`} tabIndex={-1} aria-hidden="true">
        {props.thumbnailUrl ? <Image src={props.thumbnailUrl} alt="" width={60} height={60} sizes="60px" /> : null}
      </Link>
      <Link href={href} className="saved-row-body">
        <span className="saved-row-name">{props.name}</span>
        {props.meta ? <span className="saved-row-meta">{props.meta}</span> : null}
        <span className="saved-row-score">
          {props.score !== null ? (
            <>
              <StarIcon size={12} />
              <span className="saved-row-score-value">{props.score.toFixed(1)}</span>
              <span className="saved-row-meta">({props.reviewCount})</span>
            </>
          ) : (
            <span className="saved-row-meta">{props.noRatingLabel}</span>
          )}
        </span>
      </Link>
      <div className="saved-row-side">
        <button
          type="button"
          className="saved-row-remove"
          aria-label={props.removeLabel}
          title={props.removeLabel}
          disabled={!isLoaded}
          onClick={() => {
            if (!favoriteIds.has(props.restaurantId)) return;
            setRemoved(true);
            toggle(props.restaurantId);
          }}
        >
          <CloseIcon size={14} />
        </button>
        <Link href={`${href}/review`} className="saved-row-review">
          {props.reviewLabel}
        </Link>
      </div>
    </div>
  );
}
