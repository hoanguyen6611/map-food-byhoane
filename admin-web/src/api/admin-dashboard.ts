/**
 * Typed client for the Admin Dashboard endpoint (screen 29).
 */
import type { AdminDashboardStatsDto } from '@foodmap/shared-types'
import { apiClient } from './client'

export const adminDashboardApi = {
  getStats: () => apiClient.get<AdminDashboardStatsDto>('/admin/dashboard'),
}
