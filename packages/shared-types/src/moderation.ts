// Contract for docs/build-prompts/07-contribution-media-moderation-ai.md's
// ModerationModule completion + Admin Moderation Queue (screen 31).

export type ReportTargetType = 'restaurant' | 'review';
export type ReportReason = 'spam' | 'inappropriate' | 'incorrect_info' | 'duplicate' | 'closed_down' | 'other';
export type ReportStatus = 'open' | 'escalated' | 'resolved' | 'dismissed';

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export interface ReportDto {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ResolveReportRequest {
  status: 'resolved' | 'dismissed';
}

export type ModerationTargetType = 'review' | 'contribution' | 'photo' | 'video' | 'restaurant';
export type ModerationRecommendedAction = 'auto_approve' | 'hold_for_review' | 'reject';
export type ModerationDecision = 'pending' | 'approved' | 'rejected' | 'edit_requested';

export interface AdminModerationQueueItemDto {
  id: string; // ModerationResult id
  targetType: ModerationTargetType;
  targetId: string;
  // A short, type-specific label for the tab/list UI, e.g. "Quán mới",
  // "Chỉnh sửa", "Đánh giá" — resolved server-side since only the backend
  // knows a contribution's underlying type without a second round-trip.
  contentKind: string;
  contentSummary: string;
  submitterDisplayName: string;
  submittedAt: string;
  riskScore: number;
  labels: string[];
  aiReason: string;
  recommendedAction: ModerationRecommendedAction;
  decision: ModerationDecision;
  relatedReports: ReportDto[];
}

export interface ModerationDecisionRequest {
  decision: 'approved' | 'rejected' | 'edit_requested';
  // Required unless decision === 'approved' — enforced client- and server-side.
  reason?: string;
}

// GET /admin/moderation-queue/:id/detail — the full submission behind a
// queue row's one-line `contentSummary`, fetched on demand ("Xem chi tiết")
// rather than bloating every list row with it. Shape depends on
// `targetType`/`contentKind` — `kind` is the discriminant admin-web switches
// on to pick a renderer.
export interface AdminModerationDetailPhotoDto {
  id: string;
  url: string;
}

// `payload` mirrors exactly what the contributor submitted (see
// CreateRestaurantContributionRequest for new_restaurant, or
// {kind, ...fields} for status_update/closure_report) — passed through
// loosely-typed since admin-web already knows how to render each
// `contributionType` from the original submission form's own field set.
export interface AdminModerationContributionDetailDto {
  kind: 'contribution';
  contributionType: string;
  targetRestaurantId: string | null;
  targetRestaurantName: string | null;
  payload: Record<string, unknown>;
  // edit_suggestion only — the field's live value before this change, for a
  // before/after comparison. Undefined for every other contribution type.
  oldValue?: unknown;
  photos: AdminModerationDetailPhotoDto[];
}

export interface AdminModerationPhotoDetailDto {
  kind: 'photo';
  url: string;
  uploaderDisplayName: string;
}

export interface AdminModerationReviewDetailDto {
  kind: 'review';
  restaurantName: string;
  overallRating: number;
  comment: string | null;
  ratings: { criteriaCode: string; score: number }[];
  photos: AdminModerationDetailPhotoDto[];
}

export interface AdminModerationRestaurantDetailDto {
  kind: 'restaurant';
  name: string;
  fullAddressText: string;
  categoryCode: string;
}

export type AdminModerationDetailDto =
  | AdminModerationContributionDetailDto
  | AdminModerationPhotoDetailDto
  | AdminModerationReviewDetailDto
  | AdminModerationRestaurantDetailDto;
