// Server-side-only API client (build-prompts/09-public-web.md) — every call
// here runs in a Server Component/route handler, never in the browser, so
// there's no auth-token handling, no client bundle exposure, and BACKEND_API_URL
// is read directly from `process.env` rather than threaded through
// `NEXT_PUBLIC_*`/Expo's `extra` mechanism the other two client apps use.
import type {
  CategoryDto,
  CuisineDto,
  Paginated,
  RestaurantDetailDto,
  RestaurantSitemapEntryDto,
  RestaurantSlugLookupDto,
  RestaurantSummaryDto,
  ReviewListResponse,
} from '@foodmap/shared-types';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

export class ApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
  }
}

// `tags` let backend's WebRevalidationService drop just this cache entry
// on-demand (POST /api/revalidate) right after an admin write, instead of
// every caller having to wait out `revalidateSeconds`. Both apply together —
// tags are the fast path, the time window is the fallback when nothing
// calls revalidate (e.g. WEB_APP_URL/REVALIDATE_SECRET left unconfigured).
async function apiFetch<T>(path: string, revalidateSeconds: number, tags?: string[]): Promise<T> {
  const res = await fetch(`${BACKEND_API_URL}${path}`, { next: { revalidate: revalidateSeconds, tags } });
  if (res.status === 404) {
    throw new ApiNotFoundError(path);
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Detail pages revalidate every 5 minutes — frequent enough that a review
// or an admin edit shows up promptly, infrequent enough not to hammer the
// backend for a page that's mostly static content.
const DETAIL_REVALIDATE_SECONDS = 300;
// Listing/search pages revalidate faster — filter combinations are numerous
// and each is a distinct cache entry, so staleness matters less per-entry,
// but a shorter window keeps price/hours-sensitive results reasonably fresh.
const LISTING_REVALIDATE_SECONDS = 60;
// The sitemap only needs to be roughly current, not real-time.
const SITEMAP_REVALIDATE_SECONDS = 3600;
// Categories are admin-editable but change rarely (nowhere near as often as
// a restaurant's price/hours) — a longer window than listings is fine.
const CATALOG_REVALIDATE_SECONDS = 300;

export async function getCategories(): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>('/categories', CATALOG_REVALIDATE_SECONDS, ['categories']);
}

// Admin-editable (AdminCuisineManagementPage), same revalidation window as
// getCategories — replaces lib/labels.ts's hardcoded CUISINE_OPTIONS, which
// couldn't reflect a newly-added/renamed cuisine without a code deploy.
export async function getCuisines(): Promise<CuisineDto[]> {
  return apiFetch<CuisineDto[]>('/cuisines', CATALOG_REVALIDATE_SECONDS, ['cuisines']);
}

export interface SearchParams {
  q?: string;
  cuisine?: string;
  facilities?: string;
  category?: string;
  district?: string;
  province?: string;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  openNow?: boolean;
  page?: number;
  pageSize?: number;
}

function toQueryString(params: object): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      usp.set(key, String(value));
    }
  }
  return usp.toString();
}

export async function searchRestaurants(params: SearchParams): Promise<Paginated<RestaurantSummaryDto>> {
  const qs = toQueryString(params);
  return apiFetch<Paginated<RestaurantSummaryDto>>(`/search${qs ? `?${qs}` : ''}`, LISTING_REVALIDATE_SECONDS, ['restaurants']);
}

export async function getRestaurantBySlug(slug: string): Promise<RestaurantDetailDto> {
  return apiFetch<RestaurantDetailDto>(`/restaurants/slug/${encodeURIComponent(slug)}`, DETAIL_REVALIDATE_SECONDS, [
    'restaurants',
    `restaurant:${slug}`,
  ]);
}

/**
 * Resolves restaurant ids (e.g. from a batch of notifications' deep links)
 * to their public slugs, in a single request — a `Map` since ids that don't
 * (yet, or ever) resolve are simply absent, which is the common/expected
 * case for a still-pending, rejected, or deleted contribution (the backend
 * only returns published restaurants, same visibility rule as
 * `getRestaurantBySlug`). One call handling N ids replaces what used to be
 * N separate `GET /restaurants/:id` calls each fetching (and discarding)
 * the full detail payload just to read `.slug` — see the notifications page,
 * the one caller of this.
 */
export async function getRestaurantSlugsByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const qs = ids.map(encodeURIComponent).join(',');
  const rows = await apiFetch<RestaurantSlugLookupDto[]>(`/restaurants/slugs?ids=${qs}`, DETAIL_REVALIDATE_SECONDS, [
    'restaurants',
  ]);
  return new Map(rows.map((r) => [r.id, r.slug]));
}

/**
 * Restaurants within `radiusKm` of a point, nearest-first (each item's
 * `distanceMeters` is set) — the Map page's "use my location" flow.
 * `cache: 'no-store'`, not the shared `apiFetch` helper's revalidate-based
 * caching: real GPS coordinates are effectively unique per call, so a
 * revalidate-keyed cache here would just grow unbounded for zero reuse.
 */
export async function getNearbyRestaurants(lat: number, lng: number, radiusKm?: number): Promise<RestaurantSummaryDto[]> {
  const qs = toQueryString({ lat, lng, radiusKm });
  const res = await fetch(`${BACKEND_API_URL}/restaurants/nearby?${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /restaurants/nearby -> ${res.status}`);
  }
  return res.json() as Promise<RestaurantSummaryDto[]>;
}

export async function listSitemapEntries(): Promise<RestaurantSitemapEntryDto[]> {
  return apiFetch<RestaurantSitemapEntryDto[]>('/restaurants/sitemap-index', SITEMAP_REVALIDATE_SECONDS);
}

export async function getReviewsForRestaurant(
  restaurantId: string,
  page: number,
): Promise<ReviewListResponse> {
  return apiFetch<ReviewListResponse>(
    `/restaurants/${restaurantId}/reviews?page=${page}&pageSize=10`,
    LISTING_REVALIDATE_SECONDS,
    [`restaurant:${restaurantId}`],
  );
}
