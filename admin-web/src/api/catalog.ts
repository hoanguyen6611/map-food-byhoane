/**
 * Public catalog endpoints (backend's CatalogController, no auth) — used by
 * the owner section instead of AdminFacilityController's staff-only
 * `/admin/facilities`, since an owner has no reason to see the admin
 * facility-management CRUD surface, just the live public list to pick from.
 */
import type { FacilityDto } from '@foodmap/shared-types'
import { apiClient } from './client'

export const catalogApi = {
  listFacilities: () => apiClient.get<FacilityDto[]>('/facilities'),
}
