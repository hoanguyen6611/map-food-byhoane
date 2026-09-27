import type { CategoryDto, CuisineDto, FacilityDto } from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * `CatalogModule` read endpoints — categories/facilities/cuisines are
 * admin-editable tables (AdminCategoryController et al.), not a fixed set of
 * codes a client can hardcode, so every consumer (web, admin-web, mobile)
 * reads the live list back from here instead of a static label map going
 * stale the moment an admin adds/renames one. Public — no auth required.
 */
export const catalogApi = {
  /** `GET /categories` — used anywhere a category picker/chip list needs the full live set. */
  categories: () => apiClient.get<CategoryDto[]>('/categories'),
  /** `GET /facilities` — Filter's facility chips, RestaurantDetail's facility list. */
  facilities: () => apiClient.get<FacilityDto[]>('/facilities'),
  /** `GET /cuisines` — Filter's/AddRestaurant's cuisine chips. */
  cuisines: () => apiClient.get<CuisineDto[]>('/cuisines'),
};
