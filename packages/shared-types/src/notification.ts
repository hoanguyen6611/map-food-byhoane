// Contract for docs/build-prompts/08-favorites-notifications-polish.md.
// Producer: docs/build-prompts/07-contribution-media-moderation-ai.md's
// moderation queue (not yet built) writes these on decisions; until then a
// handful of demo rows are seeded directly (prisma/seed-notifications.ts)
// so this module's UI has real data to render/test against.

export type NotificationType =
  | 'moderation_result'
  | 'report_resolved'
  | 'contribution_status'
  | 'moderation_queue_new'
  | 'review_helpful_vote'
  | 'review_helpful_milestone'
  | 'restaurant_hours_changed';

// Deep-link target — `screen` matches a mobile route name in
// MainStackParamList; the id fields are populated per notification type.
// 'moderation_result' (review decisions) -> screen: 'Reviews', restaurantId.
// 'contribution_status' -> screen: 'SubmissionStatus', contributionId.
// 'moderation_queue_new' (admin-web only) -> screen: 'AdminModeration',
// moderationTargetType + contributionId/reviewId — admin-web builds its own
// `/moderation?targetType=...` link from these, mobile ignores this type.
// 'review_helpful_vote' / 'review_helpful_milestone' -> screen: 'Reviews',
// restaurantId + reviewId (same review-detail target as moderation_result).
// 'restaurant_hours_changed' -> screen: 'RestaurantDetail', restaurantId.
export interface NotificationDeepLink {
  screen: string;
  restaurantId?: string;
  reviewId?: string;
  contributionId?: string;
  moderationTargetType?: 'contribution' | 'review';
}

export interface NotificationPayload {
  title: string;
  body: string;
  deepLink: NotificationDeepLink;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}
