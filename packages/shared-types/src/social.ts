// Public user profile (web's /profile/[id]) + Follow feature — distinct
// from auth.ts's MeResponse (the current session user only). Reuses
// GamificationDto (already id-parameterized/side-effect-free) and
// MyReviewRestaurantSummaryDto/PhotoDto rather than inventing parallel
// shapes for what's structurally the same data.
import type { GamificationDto } from './auth';
import type { MyReviewRestaurantSummaryDto } from './review';
import type { PhotoDto } from './restaurant-detail';

export interface PublicProfileContributedRestaurantDto {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  categoryLabel: string;
  compositeScore: number | null;
}

export interface PublicProfileDto {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  homeCity: string | null;
  createdAt: string;
  gamification: GamificationDto;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
  // First 12 published restaurants this user has submitted as a
  // contributor — not paginated (kept simple; a "see all" list can be a
  // later addition if a prolific contributor's list actually gets cut off).
  contributedRestaurants: PublicProfileContributedRestaurantDto[];
}

export interface PublicProfileReviewDto {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: string;
  photos: PhotoDto[];
  restaurant: MyReviewRestaurantSummaryDto;
}

export interface PublicProfileReviewListResponse {
  items: PublicProfileReviewDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FollowActionResponse {
  followerCount: number;
  isFollowedByViewer: boolean;
}
