/**
 * Typed client for the Admin User Management endpoints (screen 33).
 */
import type {
  AdminUserDetailDto,
  AdminUserListItemDto,
  Paginated,
  RoleCode,
  UpdateUserRoleRequest,
  UserStatus,
} from '@foodmap/shared-types'
import { apiClient } from './client'

export interface AdminUserListQuery {
  search?: string
  role?: RoleCode
  status?: UserStatus
  page?: number
  pageSize?: number
}

function buildListQueryString(query: AdminUserListQuery): string {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.role) params.set('role', query.role)
  if (query.status) params.set('status', query.status)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminUsersApi = {
  list: (query: AdminUserListQuery = {}) =>
    apiClient.get<Paginated<AdminUserListItemDto>>(`/admin/users${buildListQueryString(query)}`),

  detail: (id: string) => apiClient.get<AdminUserDetailDto>(`/admin/users/${id}`),

  suspend: (id: string) => apiClient.patch<void>(`/admin/users/${id}/suspend`),

  reactivate: (id: string) => apiClient.patch<void>(`/admin/users/${id}/reactivate`),

  changeRole: (id: string, body: UpdateUserRoleRequest) => apiClient.patch<void>(`/admin/users/${id}/role`, body),
}
