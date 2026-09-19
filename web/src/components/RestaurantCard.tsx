import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatPriceRange, placeTileClass } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { FavoriteButton } from './FavoriteButton';
import { OpenBadge } from './OpenBadge';
import { StarIcon } from './icons';

// Structural subset — deliberately loose so both RestaurantSummaryDto (search
// results) and FavoriteRestaurantSummaryDto (the favorites page) satisfy it
// without an adapter, same pattern mobile's RestaurantCard already uses for
// the same two DTOs. isOpenNow/categoryLabel are absent on the favorites DTO,
// so they're optional here and only render when actually known. Exported so
// PlaceRow (list-row variant, same source data) can reuse the same shape.
// categoryLabel (not categoryCode) — category is an admin-editable table,
// so the server-resolved label is used directly instead of re-translating
// a code through a static i18n dictionary (see PlaceRow's old bug: an
// admin-created category code with no matching `labels.category.*` key
// rendered as the raw i18n key string).
export interface RestaurantCardData {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  compositeScore: number | null;
  reviewCount: number;
  priceRange: RestaurantSummaryDto['priceRange'];
  isOpenNow?: boolean;
  categoryLabel?: string;
}

interface Props {
  restaurant: RestaurantCardData;
}

export async function RestaurantCard({ restaurant }: Props) {
  const tCommon = await getTranslations('common');
  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);

  return (
    <Link href={`/restaurant/${restaurant.slug}`} className="place-card">
      <div className={`place-card-photo ${restaurant.thumbnailUrl ? '' : placeTileClass(restaurant.id)}`}>
        <FavoriteButton restaurantId={restaurant.id} />
        {restaurant.thumbnailUrl ? (
          <Image
            src={restaurant.thumbnailUrl}
            alt=""
            width={260}
            height={195}
            sizes="(max-width: 640px) 45vw, 260px"
          />
        ) : (
          <span className="place-card-photo-glyph" aria-hidden="true">🍽️</span>
        )}
        {restaurant.compositeScore !== null ? (
          <span className="score-pill font-num">
            <StarIcon size={11} />
            {restaurant.compositeScore.toFixed(1)}
          </span>
        ) : null}
        {restaurant.isOpenNow !== undefined ? (
          <OpenBadge
            isOpen={restaurant.isOpenNow}
            label={restaurant.isOpenNow ? tCommon('openNow') : tCommon('closedNow')}
          />
        ) : null}
      </div>
      <div className="place-card-body">
        <p className="place-card-name">{restaurant.name}</p>
        <div className="place-card-meta">
          {priceLabel ? `${priceLabel}đ` : ''}
        </div>
        <div className="place-card-foot">
          {restaurant.compositeScore !== null ? (
            <>
              <StarIcon size={12} />
              {restaurant.compositeScore.toFixed(1)}
              <span className="place-card-review-count">({restaurant.reviewCount})</span>
            </>
          ) : (
            <span className="place-card-review-count">{tCommon('noRating')}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
