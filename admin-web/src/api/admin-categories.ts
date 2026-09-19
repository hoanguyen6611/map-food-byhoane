/** Typed client for the Admin Category Management endpoints (GET/POST/PATCH/DELETE /admin/categories). */
import type { CategoryDto } from '@foodmap/shared-types'
import { apiClient } from './client'

export interface CreateCategoryBody {
  code: string
  label: string
  icon?: string
}

export interface UpdateCategoryBody {
  label?: string
  icon?: string
}

export const adminCategoriesApi = {
  list: () => apiClient.get<CategoryDto[]>('/admin/categories'),
  create: (body: CreateCategoryBody) => apiClient.post<CategoryDto>('/admin/categories', body),
  update: (id: string, body: UpdateCategoryBody) =>
    apiClient.patch<CategoryDto>(`/admin/categories/${id}`, body),
  remove: (id: string) => apiClient.delete<void>(`/admin/categories/${id}`),
}
