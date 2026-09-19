/** Typed client for the Admin Facility Management endpoints (GET/POST/PATCH/DELETE /admin/facilities). */
import type { FacilityDto } from '@foodmap/shared-types'
import { apiClient } from './client'

export interface CreateFacilityBody {
  code: string
  label: string
  icon?: string
}

export interface UpdateFacilityBody {
  label?: string
  icon?: string
}

export const adminFacilitiesApi = {
  list: () => apiClient.get<FacilityDto[]>('/admin/facilities'),
  create: (body: CreateFacilityBody) => apiClient.post<FacilityDto>('/admin/facilities', body),
  update: (id: string, body: UpdateFacilityBody) =>
    apiClient.patch<FacilityDto>(`/admin/facilities/${id}`, body),
  remove: (id: string) => apiClient.delete<void>(`/admin/facilities/${id}`),
}
