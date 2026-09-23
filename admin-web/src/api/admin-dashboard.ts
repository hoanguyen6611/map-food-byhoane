/**
 * Typed client for the Admin Dashboard endpoint (screen 29).
 */
import type { AdminDashboardStatsDto, AuditLogEntryDto, Paginated } from '@foodmap/shared-types'
import { apiClient } from './client'

export interface AuditLogQuery {
  page?: number
  pageSize?: number
}

function buildAuditLogQueryString(query: AuditLogQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminDashboardApi = {
  getStats: () => apiClient.get<AdminDashboardStatsDto>('/admin/dashboard'),

  /** "Hoạt động gần đây" feed — a thin read over AuditLogService's append-only log. */
  getAuditLog: (query: AuditLogQuery = {}) =>
    apiClient.get<Paginated<AuditLogEntryDto>>(`/admin/audit-log${buildAuditLogQueryString(query)}`),
}
