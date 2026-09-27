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

// "Feed" (web's /feed) — recent published reviews from users the viewer
// follows. Same shape as PublicProfileReviewDto plus `author`, since unlike
// a single user's own review list, the feed mixes reviews from many
// different people and needs to show who posted each one.
export interface FeedReviewDto extends PublicProfileReviewDto {
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    isAnonymized: boolean;
  };
}

export interface FeedResponse {
  items: FeedReviewDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FollowActionResponse {
  followerCount: number;
  isFollowedByViewer: boolean;
}

// Public contributor leaderboard (web's /leaderboard) — `points`/`level` use
// the exact same weights/thresholds as GamificationDto (GamificationService
// exports its scoring constants so this can never drift out of sync with a
// user's own profile page), aggregated across ALL users instead of computed
// one at a time. Excludes UserProfile.isPublic === false users, same
// visibility rule PublicProfileDto's own gate uses.
export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  level: number;
}

export interface LeaderboardResponse {
  items: LeaderboardEntryDto[];
}
