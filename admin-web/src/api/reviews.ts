/**
 * Public Review endpoints, reused as-is by the owner reviews page
 * (OwnerReviewsPage.tsx) — an owner replying to a review is functionally
 * identical to any other logged-in user replying (POST /reviews/:id/replies
 * has no ownership/role gating by design), so there's no owner-specific
 * backend route here. What IS owner-specific is purely the `isOwnerReply`
 * flag already carried on `ReviewReplyDto` by the backend.
 */
import type { ReviewListResponse, ReviewReplyDto, ReviewReplyListResponse } from '@foodmap/shared-types'
import { apiClient } from './client'

export const reviewsApi = {
  listForRestaurant: (restaurantId: string, page = 1, pageSize = 20) =>
    apiClient.get<ReviewListResponse>(
      `/restaurants/${restaurantId}/reviews?page=${page}&pageSize=${pageSize}`,
    ),

  listReplies: (reviewId: string) => apiClient.get<ReviewReplyListResponse>(`/reviews/${reviewId}/replies`),

  createReply: (reviewId: string, body: string) =>
    apiClient.post<ReviewReplyDto>(`/reviews/${reviewId}/replies`, { body }),
}
