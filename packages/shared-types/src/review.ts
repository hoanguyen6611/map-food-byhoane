// Contract for docs/build-prompts/06-reviews-scoring.md.
import type { PhotoDto } from './restaurant-detail';

export type ReviewCriteriaCode =
  | 'food_quality'
  | 'space'
  | 'price'
  | 'service'
  | 'hygiene'
  | 'wifi'
  | 'parking';

export type ReviewStatus = 'pending' | 'published' | 'rejected' | 'hidden';

export type ReviewSort = 'newest' | 'most_helpful' | 'has_photos';

export interface ReviewRatingInput {
  criteriaCode: ReviewCriteriaCode;
  score: number; // 1-5
}

export interface CreateReviewRequest {
  restaurantId: string;
  overallRating: number; // 1-5
  ratings: ReviewRatingInput[]; // at least 1 required
  comment?: string;
  dishesOrdered?: string[];
  billTotalVnd?: number;
  partySize?: number;
  visitedAt?: string; // ISO date
  waitTimeMinutes?: number;
  wouldReturn?: boolean;
  // Ids of photos already uploaded via MediaModule (build-prompts/07) — the
  // server reparents these onto the created review, enforcing the 6-photo cap.
  photoIds?: string[];
  // URLs already hosted on ImageKit (the web app's direct-upload flow) — the
  // server attaches these onto the created review, same 6-photo cap as
  // photoIds. Same pattern as CreateRestaurantContributionRequest.photoUrls.
  photoUrls?: string[];
}

// Same field set as create, all optional (PATCH semantics) — `ratings`, when
// provided, is a full replace of the criteria scores, not a partial merge.
export interface UpdateReviewRequest {
  overallRating?: number;
  ratings?: ReviewRatingInput[];
  comment?: string;
  dishesOrdered?: string[];
  billTotalVnd?: number;
  partySize?: number;
  visitedAt?: string;
  waitTimeMinutes?: number;
  wouldReturn?: boolean;
  photoIds?: string[];
  photoUrls?: string[];
}

export interface ReviewAuthorDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewDto {
  id: string;
  restaurantId: string;
  author: ReviewAuthorDto;
  overallRating: number;
  ratings: ReviewRatingInput[];
  comment: string | null;
  dishesOrdered: string[];
  billTotalVnd: number | null;
  partySize: number | null;
  visitedAt: string | null;
  waitTimeMinutes: number | null;
  wouldReturn: boolean | null;
  status: ReviewStatus;
  // Non-null => show the public "Đã chỉnh sửa" marker (only set when an edit
  // happens >48h after createdAt — see docs/01-prd-mvp.md §10.5).
  editedAt: string | null;
  createdAt: string;
  photos: PhotoDto[];
  // Real counts backed by ReviewHelpfulVote/ReviewReply — replaces the old
  // presentational-only "Hữu ích" button.
  helpfulCount: number;
  replyCount: number;
  // Only meaningful for an authenticated viewer; `false` wherever the current
  // viewer isn't resolvable (e.g. a fully anonymous public read).
  viewerHasMarkedHelpful: boolean;
}

export interface ToggleHelpfulResponse {
  helpfulCount: number;
  viewerHasMarkedHelpful: boolean;
}

export interface ReviewReplyDto {
  id: string;
  author: ReviewAuthorDto;
  body: string;
  createdAt: string;
}

export interface CreateReviewReplyRequest {
  body: string;
}

export interface ReviewReplyListResponse {
  items: ReviewReplyDto[];
}

export interface ReviewCriteriaBreakdownDto {
  code: ReviewCriteriaCode;
  label: string;
  // null when nobody has rated this criterion yet — never fabricate a 0.
  averageScore: number | null;
  ratingCount: number;
}

export interface ReviewListResponse {
  items: ReviewDto[];
  total: number;
  page: number;
  pageSize: number;
  ratingBreakdown: ReviewCriteriaBreakdownDto[];
}

// "My Reviews" (profile) — reviews are normally rendered on an
// already-restaurant-scoped page (ReviewDto has no restaurant info for that
// reason), but a cross-restaurant list needs enough to identify/link each
// one, same rationale as AdminReviewListItemDto's restaurantName below.
export interface MyReviewRestaurantSummaryDto {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  // Modern replacement for the deprecated `district` concept (see
  // ContributionAddressDto's comment) — null for legacy addresses that
  // predate ward data.
  ward: string | null;
}

export interface MyReviewDto extends ReviewDto {
  restaurant: MyReviewRestaurantSummaryDto;
}

export interface MyReviewListResponse {
  items: MyReviewDto[];
  total: number;
  page: number;
  pageSize: number;
}

// Admin Review Management — docs/04-screen-list.md §32. Separate from
// ReviewDto (the public/owner-facing shape) since this is admin-only and
// includes moderation context (riskScore/labels) that ordinary review reads
// never expose. riskScore/labels are null when no ModerationResult exists
// for this review yet (e.g. it predates the AI moderation gateway).
export interface AdminReviewListItemDto {
  id: string;
  restaurantId: string;
  restaurantName: string;
  author: ReviewAuthorDto;
  overallRating: number;
  comment: string | null;
  status: ReviewStatus;
  riskScore: number | null;
  labels: string[];
  createdAt: string;
}
