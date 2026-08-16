/**
 * Typed client for the Admin Review Management endpoints (screen 32) —
 * managing ALREADY PUBLISHED reviews (hide/restore/delete), distinct from
 * the Admin Moderation Queue's pending-decision workflow.
 */
import type { AdminReviewListItemDto, Paginated, ReviewStatus } from '@foodmap/shared-types'
import { apiClient } from './client'

export interface AdminReviewListQuery {
  restaurantId?: string
  userId?: string
  status?: ReviewStatus
  minRiskScore?: number
  search?: string
  page?: number
  pageSize?: number
}

function buildListQueryString(query: AdminReviewListQuery): string {
  const params = new URLSearchParams()
  if (query.restaurantId) params.set('restaurantId', query.restaurantId)
  if (query.userId) params.set('userId', query.userId)
  if (query.status) params.set('status', query.status)
  if (query.minRiskScore !== undefined) params.set('minRiskScore', String(query.minRiskScore))
  if (query.search) params.set('search', query.search)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminReviewsApi = {
  list: (query: AdminReviewListQuery = {}) =>
    apiClient.get<Paginated<AdminReviewListItemDto>>(`/admin/reviews${buildListQueryString(query)}`),

  hide: (id: string) => apiClient.patch<void>(`/admin/reviews/${id}/hide`),

  restore: (id: string) => apiClient.patch<void>(`/admin/reviews/${id}/restore`),

  remove: (id: string) => apiClient.delete<void>(`/admin/reviews/${id}`),
}
