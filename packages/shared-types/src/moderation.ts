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
