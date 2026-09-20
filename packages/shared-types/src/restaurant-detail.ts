// Contract for docs/build-prompts/05-restaurant-detail-admin-seed.md.
import type {
  CuisineCode,
  FacilityType,
  PriceRangeDto,
  RestaurantCategoryCode,
  RestaurantPublicationStatus,
} from './restaurant';
import type { ReviewDto } from './review';

export interface AddressDto {
  line: string;
  ward: string | null;
  district: string;
  province: string;
  fullAddressText: string;
}

export interface LocationDto {
  lat: number;
  lng: number;
}

export interface OpeningHourDto {
  dayOfWeek: number; // 0=Sunday..6=Saturday
  openTime: string | null; // "HH:mm", null when isClosed or isOpen24h
  closeTime: string | null;
  isClosed: boolean;
  // Open all 24 hours of this day — when true, openTime/closeTime/
  // openTime2/closeTime2 are all null and should be ignored by callers.
  isOpen24h: boolean;
  // Optional second range for the same day (e.g. 11:00-14:00 lunch, this
  // pair for 17:00-22:00 dinner) — either both set or both null, never one
  // without the other.
  openTime2: string | null;
  closeTime2: string | null;
}

export interface PhotoDto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface MenuItemDto {
  id: string;
  name: string;
  priceVnd: number;
  category: string | null;
  isPopular: boolean;
}

export interface MenuDto {
  id: string;
  name: string | null;
  items: MenuItemDto[];
}

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'website';

// Admin-entered/verified only for now — no self-service owner-claim flow
// exists yet. `verified` is only meaningful for facebook/instagram (the two
// platforms an admin can actually confirm ownership of); it's always false
// for tiktok/website, which have no verification concept in the UI.
export interface RestaurantSocialLinkDto {
  platform: SocialPlatform;
  url: string;
  verified: boolean;
}

// `reviews` (build-prompts/06) is a small newest-first PREVIEW (not the full
// list — see GET /restaurants/:id/reviews in review.ts for the paginated
// view with the full rating breakdown). AI Summary (build-prompts/07,
// US-J1/J2) deliberately isn't inlined here — it's fetched via the separate
// `GET /restaurants/:id/ai-summary` endpoint (see AISummaryResponseDto in
// ai-summary.ts) so a slow/optional AI fetch never blocks the core detail
// response.
export interface RestaurantDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryCode: RestaurantCategoryCode;
  /** RestaurantCategory.label, resolved server-side — see RestaurantSummaryDto's comment. */
  categoryLabel: string;
  cuisineCodes: CuisineCode[];
  phone: string | null;
  address: AddressDto;
  location: LocationDto;
  priceRange: PriceRangeDto | null;
  openingHours: OpeningHourDto[];
  isOpenNow: boolean;
  facilities: FacilityType[];
  menus: MenuDto[];
  photos: PhotoDto[];
  // Which of `photos` (if any) is the explicitly-chosen "ảnh đại diện" —
  // null means no explicit choice, so the public thumbnail/gallery-hero
  // falls back to the oldest approved photo (see RestaurantService's
  // coverPhotoId schema comment). Admin-web's photo picker uses this to
  // highlight the current choice.
  coverPhotoId: string | null;
  // Only platforms that actually have a URL set — same "don't fabricate
  // sections you have no real data for" convention as `facilities`/
  // `cuisineCodes` above. Empty array is normal/common, not an error.
  socialLinks: RestaurantSocialLinkDto[];
  compositeScore: number | null;
  reviewCount: number;
  /** Raw page-view counter (every detail-page load, no dedup) — see AdminRestaurantService/RestaurantService's `viewCount` schema comment. */
  viewCount: number;
  reviews: ReviewDto[];
}

// Admin/moderator view adds lifecycle fields not exposed publicly.
export interface AdminRestaurantDetailDto extends RestaurantDetailDto {
  publicationStatus: RestaurantPublicationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AdminRestaurantListItemDto {
  id: string;
  name: string;
  categoryCode: RestaurantCategoryCode;
  province: string;
  ward: string | null;
  district: string;
  publicationStatus: RestaurantPublicationStatus;
  createdAt: string;
}

// build-prompts/09-public-web.md's sitemap.xml generator — every published
// restaurant's slug + last-updated timestamp, nothing else.
export interface RestaurantSitemapEntryDto {
  slug: string;
  updatedAt: string;
}

// Batch id->slug lookup (GET /restaurants/slugs?ids=...) — e.g. resolving
// notification deep-links to real detail-page URLs without fetching each
// restaurant's full detail payload just to read one field. Ids that don't
// resolve to a published restaurant (pending/rejected/deleted/unknown) are
// simply omitted, same "no such restaurant" semantics as GET /restaurants/:id.
export interface RestaurantSlugLookupDto {
  id: string;
  slug: string;
}
