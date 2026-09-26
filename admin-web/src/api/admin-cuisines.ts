/** Typed client for the Admin Cuisine Management endpoints (GET/POST/PATCH/DELETE /admin/cuisines). */
import type { CuisineDto } from '@foodmap/shared-types'
import { apiClient } from './client'

export interface CreateCuisineBody {
  code: string
  label: string
}

export interface UpdateCuisineBody {
  label?: string
  isPublic?: boolean
}

export const adminCuisinesApi = {
  list: () => apiClient.get<CuisineDto[]>('/admin/cuisines'),
  create: (body: CreateCuisineBody) => apiClient.post<CuisineDto>('/admin/cuisines', body),
  update: (id: string, body: UpdateCuisineBody) =>
    apiClient.patch<CuisineDto>(`/admin/cuisines/${id}`, body),
  remove: (id: string) => apiClient.delete<void>(`/admin/cuisines/${id}`),
}
