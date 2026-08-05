import Image from 'next/image';
import Link from 'next/link';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { formatPriceRange } from '@/lib/format';

interface Props {
  restaurant: RestaurantSummaryDto;
}

export function RestaurantCard({ restaurant }: Props) {
  const priceLabel = formatPriceRange(restaurant.priceRange);

  return (
    <Link href={`/quan/${restaurant.slug}`} className="restaurant-card">
      <div className="thumb">
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
              : 'Chưa có đánh giá'}
          </span>
          {priceLabel ? <span>· {priceLabel}đ</span> : null}
        </div>
        <div className="meta" style={{ marginTop: 6 }}>
          <span className={`badge ${restaurant.isOpenNow ? 'badge-open' : 'badge-closed'}`}>
            {restaurant.isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}
          </span>
        </div>
      </div>
    </Link>
  );
}
