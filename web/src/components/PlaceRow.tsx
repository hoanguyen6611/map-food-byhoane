import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { formatPriceRange, placeTileClass } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import type { RestaurantCardData } from './RestaurantCard';
import { OpenBadge } from './OpenBadge';
import { StarIcon } from './icons';

interface Props {
  restaurant: RestaurantCardData;
  thumb?: number;
  showStatus?: boolean;
  /** Pre-translated area label (district name) shown after the category — omitted when unknown, never fabricated. */
  area?: string;
}

/**
 * List-row variant of RestaurantCard (README's `PlaceRow`) — Search's list
 * view, the District/Area page, and the Map page's sidebar list. No
 * blurb/facility-footer here: `RestaurantSummaryDto` carries neither, so
 * showing them would mean inventing data the API never returned.
 */
export async function PlaceRow({ restaurant, thumb = 88, showStatus = true, area }: Props) {
  const [tCommon, tLabels] = await Promise.all([getTranslations('common'), getTranslations('labels')]);
  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);
  const categoryLabel = restaurant.categoryCode ? tLabels(`category.${restaurant.categoryCode}`) : null;

  return (
    <Link href={`/restaurant/${restaurant.slug}`} className="place-row">
      <div
        className={`place-row-thumb ${restaurant.thumbnailUrl ? '' : placeTileClass(restaurant.id)}`}
        style={{ width: thumb, height: thumb }}
      >
        {restaurant.thumbnailUrl ? (
          <Image src={restaurant.thumbnailUrl} alt="" width={thumb} height={thumb} sizes={`${thumb}px`} />
        ) : (
          <span aria-hidden="true" style={{ opacity: 0.38, fontSize: thumb * 0.4 }}>
            🍽️
          </span>
        )}
      </div>
      <div className="place-row-body">
        <div className="place-row-name-row">
          <p className="place-row-name">{restaurant.name}</p>
          {showStatus && restaurant.isOpenNow !== undefined ? (
            <OpenBadge
              isOpen={restaurant.isOpenNow}
              label={restaurant.isOpenNow ? tCommon('openNow') : tCommon('closedNow')}
            />
          ) : null}
        </div>
        <div className="place-row-score-line">
          {restaurant.compositeScore !== null ? (
            <>
              <StarIcon size={13} />
              <span className="place-row-score">{restaurant.compositeScore.toFixed(1)}</span>
              <span className="place-row-score-meta">
                ({restaurant.reviewCount})
                {categoryLabel ? ` · ${categoryLabel}` : ''}
                {area ? ` · ${area}` : ''}
              </span>
            </>
          ) : (
            <span className="place-row-score-meta">
              {tCommon('noRating')}
              {categoryLabel ? ` · ${categoryLabel}` : ''}
              {area ? ` · ${area}` : ''}
            </span>
          )}
        </div>
        {priceLabel ? (
          <div className="place-row-footer">
            <span className="place-row-price">{priceLabel}đ</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
