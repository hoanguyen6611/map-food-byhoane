// User-created named restaurant lists (web's /collections), optionally
// shareable via a public link when `isPublic`. Reuses FavoriteRestaurantSummaryDto
// for item rows rather than inventing a parallel restaurant-summary shape —
// same fields a collection's items need, already RestaurantCard-compatible.
import type { FavoriteRestaurantSummaryDto } from './favorite';

export interface CollectionSummaryDto {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionListResponse {
  items: CollectionSummaryDto[];
}

export interface CollectionItemDto {
  restaurant: FavoriteRestaurantSummaryDto;
  addedAt: string;
}

export interface CollectionDetailDto {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  // True only when the requesting viewer owns this collection — gates the
  // edit/delete/add-item affordances client-side (the backend independently
  // enforces ownership on every write, this is presentation-only).
  isOwner: boolean;
  items: CollectionItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
}
