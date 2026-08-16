// Contract for docs/build-prompts/08-favorites-notifications-polish.md.
import type { PriceRangeDto, RestaurantCategoryCode } from './restaurant';

export interface FavoriteRestaurantSummaryDto {
  id: string;
  slug: string;
  name: string;
  categoryCode: RestaurantCategoryCode;
  thumbnailUrl: string | null;
  compositeScore: number | null;
  reviewCount: number;
  priceRange: PriceRangeDto | null;
  district: string;
}

export interface FavoriteDto {
  id: string;
  restaurantId: string;
  createdAt: string;
  restaurant: FavoriteRestaurantSummaryDto;
}

export interface FavoriteListResponse {
  items: FavoriteDto[];
  total: number;
  page: number;
  pageSize: number;
}

// POST/DELETE /favorites/:restaurantId are idempotent toggles — both return
// the resulting state so the client can sync optimistic UI from the
// response rather than assuming success meant "now favorited".
export interface FavoriteStatusDto {
  restaurantId: string;
  isFavorited: boolean;
}
