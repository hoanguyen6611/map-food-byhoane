// Restaurant Owner self-service dashboard (admin-web's /owner/* section) —
// distinct from the admin/moderator-facing Admin* DTOs in restaurant.ts /
// admin-dashboard.ts, since an owner is scoped to only their own
// restaurant(s), never staff's full CRUD surface.

import type { FacilityType } from './restaurant';
import type { LocationDto, PhotoDto } from './restaurant-detail';
import type { ContributionOpeningHourInput } from './contribution';

export interface OwnerRestaurantListItemDto {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
}

export interface OwnerRestaurantAddressDto {
  line: string;
  ward: string | null;
  district: string;
  province: string;
}

// All fields here are exactly OwnerRestaurantEditPage.tsx's editable set
// (see EDITABLE_FIELDS) plus the read-only bits its photos tab needs —
// deliberately not the full admin AdminRestaurantDetailDto shape. Opening
// hours reuse `ContributionOpeningHourInput` (now including
// isOpen24h/openTime2/closeTime2, same per-day richness as the admin
// editor) rather than inventing a parallel type — an owner's restaurant can
// already use 24h or split-shift hours, so this needs to read/write them
// too, not just the plain "open X–Y or closed" case a new-restaurant
// submission ever sets.
export interface OwnerRestaurantDetailDto {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: OwnerRestaurantAddressDto;
  location: LocationDto;
  openingHours: ContributionOpeningHourInput[];
  facilities: FacilityType[];
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  photos: PhotoDto[];
  coverPhotoId: string | null;
  menuPhotos: PhotoDto[];
}

// Lifetime totals only — RestaurantStatus has no time-series/day-bucketed
// view data, so there's no "this week vs last week" trend to show yet.
export interface OwnerRestaurantStatsDto {
  viewCount: number;
  reviewCount: number;
  compositeScore: number | null;
  lastReviewAt: string | null;
  lastComputedAt: string | null;
}
