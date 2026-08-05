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
}

export interface ReviewAuthorDto {
  id: string;
  displayName: string;
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
