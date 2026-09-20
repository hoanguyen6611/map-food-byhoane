/**
 * Typed client for the Admin Moderation Queue endpoints
 * (docs/build-prompts/07-contribution-media-moderation-ai.md, screen 31).
 *
 * Response/request DTOs are imported directly from `@foodmap/shared-types`
 * (already shared with the backend) — unlike admin-restaurants.ts, this
 * module's request bodies are also exported from shared-types, so nothing
 * needs to be hand-redeclared here.
 */
import type {
  AdminModerationDetailDto,
  AdminModerationQueueItemDto,
  ModerationDecisionRequest,
  ModerationDecision,
  ModerationTargetType,
  Paginated,
  ReportDto,
  ResolveReportRequest,
} from '@foodmap/shared-types'
import { apiClient } from './client'

export interface AdminModerationListQuery {
  targetType?: ModerationTargetType
  decision?: ModerationDecision
  page?: number
  pageSize?: number
}

function buildListQueryString(query: AdminModerationListQuery): string {
  const params = new URLSearchParams()
  if (query.targetType) params.set('targetType', query.targetType)
  if (query.decision) params.set('decision', query.decision)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminModerationApi = {
  list: (query: AdminModerationListQuery = {}) =>
    apiClient.get<Paginated<AdminModerationQueueItemDto>>(
      `/admin/moderation-queue${buildListQueryString(query)}`,
    ),

  /** Fetched on demand ("Xem chi tiết") — the full submission behind a row's one-line summary. */
  getDetail: (moderationResultId: string) =>
    apiClient.get<AdminModerationDetailDto>(`/admin/moderation-queue/${moderationResultId}/detail`),

  /** `reason` is required unless `decision === 'approved'` — enforced server-side too. */
  decide: (moderationResultId: string, body: ModerationDecisionRequest) =>
    apiClient.post<void>(`/admin/moderation-queue/${moderationResultId}/decision`, body),

  resolveReport: (reportId: string, body: ResolveReportRequest) =>
    apiClient.patch<ReportDto>(`/admin/reports/${reportId}/resolve`, body),
}
