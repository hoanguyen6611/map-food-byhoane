// Server-side-only API client (build-prompts/09-public-web.md) — every call
// here runs in a Server Component/route handler, never in the browser, so
// there's no auth-token handling, no client bundle exposure, and BACKEND_API_URL
// is read directly from `process.env` rather than threaded through
// `NEXT_PUBLIC_*`/Expo's `extra` mechanism the other two client apps use.
import type {
  FavoriteListResponse,
  Paginated,
  RestaurantDetailDto,
  RestaurantSitemapEntryDto,
  RestaurantSummaryDto,
  ReviewListResponse,
} from '@foodmap/shared-types';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

export class ApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
  }
}

async function apiFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(`${BACKEND_API_URL}${path}`, { next: { revalidate: revalidateSeconds } });
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

export interface SearchParams {
  q?: string;
  cuisine?: string;
  facilities?: string;
  category?: string;
  district?: string;
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
  return apiFetch<Paginated<RestaurantSummaryDto>>(`/search${qs ? `?${qs}` : ''}`, LISTING_REVALIDATE_SECONDS);
}

export async function getRestaurantBySlug(slug: string): Promise<RestaurantDetailDto> {
  return apiFetch<RestaurantDetailDto>(`/restaurants/slug/${encodeURIComponent(slug)}`, DETAIL_REVALIDATE_SECONDS);
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
  );
}

// Authenticated, uncached — per-user data, unlike everything else in this
// file which is public and revalidate-cached.
export async function getFavorites(accessToken: string, page: number): Promise<FavoriteListResponse> {
  const res = await fetch(`${BACKEND_API_URL}/me/favorites?page=${page}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/favorites -> ${res.status}`);
  }
  return res.json() as Promise<FavoriteListResponse>;
}
