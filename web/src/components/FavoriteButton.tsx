'use client';

import { useTranslations } from 'next-intl';
import { useFavorites } from './FavoritesProvider';

interface Props {
  restaurantId: string;
}

export function FavoriteButton({ restaurantId }: Props) {
  const t = useTranslations('common');
  const { favoriteIds, isLoaded, toggle } = useFavorites();
  const isFavorited = favoriteIds.has(restaurantId);

  return (
    <button
      type="button"
      className={`favorite-button ${isFavorited ? 'favorite-button-active' : ''}`}
      aria-label={isFavorited ? t('favoriteRemove') : t('favoriteAdd')}
      aria-pressed={isFavorited}
      disabled={!isLoaded}
      onClick={(event) => {
        // Stops the click from bubbling to the wrapping <Link> (RestaurantCard,
        // the restaurant-detail page) that this button sits inside.
        event.preventDefault();
        event.stopPropagation();
        toggle(restaurantId);
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 21s-7.5-4.6-10-9.2C.4 8.6 1.7 5 5.2 4.2 7.6 3.6 9.9 4.7 12 7c2.1-2.3 4.4-3.4 6.8-2.8 3.5.8 4.8 4.4 3.2 7.6C19.5 16.4 12 21 12 21z"
          fill={isFavorited ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
