import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatPriceRange } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { FavoriteButton } from './FavoriteButton';

// Structural subset — deliberately loose so both RestaurantSummaryDto (search
// results) and FavoriteRestaurantSummaryDto (the favorites page) satisfy it
// without an adapter, same pattern mobile's RestaurantCard already uses for
// the same two DTOs. isOpenNow is absent on the favorites DTO, so it's
// optional here and the badge only renders when it's actually known.
interface RestaurantCardData {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  compositeScore: number | null;
  reviewCount: number;
  priceRange: RestaurantSummaryDto['priceRange'];
  isOpenNow?: boolean;
}

interface Props {
  restaurant: RestaurantCardData;
}

export async function RestaurantCard({ restaurant }: Props) {
  const tCommon = await getTranslations('common');
  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);

  return (
    <Link href={`/restaurant/${restaurant.slug}`} className="restaurant-card">
      <div className="thumb">
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
          <span aria-hidden="true">🍽️</span>
        )}
      </div>
      <div className="body">
        <p className="name">{restaurant.name}</p>
        <div className="meta">
          <span>
            {restaurant.compositeScore !== null
              ? `★ ${restaurant.compositeScore.toFixed(1)} (${restaurant.reviewCount})`
              : tCommon('noRating')}
          </span>
          {priceLabel ? <span>· {priceLabel}đ</span> : null}
        </div>
        {restaurant.isOpenNow !== undefined ? (
          <div className="meta" style={{ marginTop: 6 }}>
            <span className={`badge ${restaurant.isOpenNow ? 'badge-open' : 'badge-closed'}`}>
              {restaurant.isOpenNow ? tCommon('openNow') : tCommon('closedNow')}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
