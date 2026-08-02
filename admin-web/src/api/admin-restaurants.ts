/**
 * Typed client for the Admin Restaurant Management endpoints
 * (docs/build-prompts/05-restaurant-detail-admin-seed.md, screen 30).
 *
 * Response DTOs are imported directly from `@foodmap/shared-types` (already
 * shared with the backend). Request-body shapes below are backend-local
 * class-validator DTOs that are not exported from shared-types, so they are
 * redeclared here as plain TypeScript interfaces mirroring the backend's
 * validation rules exactly (see AdminRestaurantController /
 * dto/*.dto.ts) — kept in sync by hand.
 */
import type {
  AdminRestaurantDetailDto,
  AdminRestaurantListItemDto,
  CuisineCode,
  FacilityType,
  MenuItemDto,
  PhotoDto,
  PriceRangeCode,
  RestaurantCategoryCode,
  RestaurantPublicationStatus,
  Paginated,
} from '@foodmap/shared-types'
import { apiClient } from './client'

// ---------- list query ----------

export interface AdminRestaurantListQuery {
  status?: RestaurantPublicationStatus
  province?: string
  district?: string
  search?: string
  page?: number
  pageSize?: number
}

// ---------- request bodies ----------

export interface AddressInput {
  line: string
  ward?: string
  district: string
  province: string
}

export interface LocationInput {
  lat: number
  lng: number
}

/** Body for POST /admin/restaurants — address/location are required. */
export interface CreateRestaurantBody {
  name: string
  description?: string
  categoryCode: RestaurantCategoryCode
  priceRangeCode?: PriceRangeCode
  phone?: string
  address: AddressInput
  location: LocationInput
  cuisineCodes?: CuisineCode[]
}

/**
 * Body for PATCH /admin/restaurants/:id — every field optional, but if
 * `address`/`location` are supplied they must be complete objects (the
 * backend does not support partial-address patches).
 */
export interface UpdateRestaurantBody {
  name?: string
  description?: string
  categoryCode?: RestaurantCategoryCode
  priceRangeCode?: PriceRangeCode
  phone?: string
  address?: AddressInput
  location?: LocationInput
  cuisineCodes?: CuisineCode[]
}

export interface OpeningHourEntryInput {
  dayOfWeek: number // 0=Sunday..6=Saturday
  openTime?: string // "HH:mm", ignored when isClosed
  closeTime?: string
  isClosed: boolean
}

/** Body for PUT /admin/restaurants/:id/opening-hours — always exactly 7 entries. */
export interface ReplaceOpeningHoursBody {
  days: OpeningHourEntryInput[]
}

/** Body for PUT /admin/restaurants/:id/facilities — full-set replace. */
export interface ReplaceFacilitiesBody {
  facilities: FacilityType[]
}

export interface CreateMenuItemBody {
  name: string
  priceVnd: number
  category?: string
  isPopular?: boolean
}

export interface UpdateMenuItemBody {
  name?: string
  priceVnd?: number
  category?: string
  isPopular?: boolean
}

export interface AttachPhotoBody {
  url: string
  width?: number
  height?: number
}

// ---------- endpoints ----------

function buildListQueryString(query: AdminRestaurantListQuery): string {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.province) params.set('province', query.province)
  if (query.district) params.set('district', query.district)
  if (query.search) params.set('search', query.search)
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const adminRestaurantsApi = {
  list: (query: AdminRestaurantListQuery = {}) =>
    apiClient.get<Paginated<AdminRestaurantListItemDto>>(
      `/admin/restaurants${buildListQueryString(query)}`,
    ),

  getById: (id: string) => apiClient.get<AdminRestaurantDetailDto>(`/admin/restaurants/${id}`),

  create: (body: CreateRestaurantBody) =>
    apiClient.post<AdminRestaurantDetailDto>('/admin/restaurants', body),

  update: (id: string, body: UpdateRestaurantBody) =>
    apiClient.patch<AdminRestaurantDetailDto>(`/admin/restaurants/${id}`, body),

  hide: (id: string) => apiClient.post<void>(`/admin/restaurants/${id}/hide`),

  restore: (id: string) => apiClient.post<void>(`/admin/restaurants/${id}/restore`),

  /** Hard delete — admin role only; backend returns 403 for moderator. */
  remove: (id: string) => apiClient.delete<void>(`/admin/restaurants/${id}`),

  replaceOpeningHours: (id: string, body: ReplaceOpeningHoursBody) =>
    apiClient.put<void>(`/admin/restaurants/${id}/opening-hours`, body),

  replaceFacilities: (id: string, body: ReplaceFacilitiesBody) =>
    apiClient.put<void>(`/admin/restaurants/${id}/facilities`, body),

  createMenuItem: (id: string, body: CreateMenuItemBody) =>
    apiClient.post<MenuItemDto>(`/admin/restaurants/${id}/menu-items`, body),

  updateMenuItem: (itemId: string, body: UpdateMenuItemBody) =>
    apiClient.patch<MenuItemDto>(`/admin/restaurants/menu-items/${itemId}`, body),

  deleteMenuItem: (itemId: string) =>
    apiClient.delete<void>(`/admin/restaurants/menu-items/${itemId}`),

  attachPhoto: (id: string, body: AttachPhotoBody) =>
    apiClient.post<PhotoDto>(`/admin/restaurants/${id}/photos`, body),

  deletePhoto: (photoId: string) =>
    apiClient.delete<void>(`/admin/restaurants/photos/${photoId}`),
}
