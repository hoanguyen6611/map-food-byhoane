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
  openTime: string | null; // "HH:mm", null when isClosed
  closeTime: string | null;
  isClosed: boolean;
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

// `aiSummary` is always null until build-prompts/07 populates it — the
// contract is stable now so that module doesn't need to change this shape,
// only fill in a real value. `reviews` (build-prompts/06) is a small
// newest-first PREVIEW (not the full list — see GET /restaurants/:id/reviews
// in review.ts for the paginated view with the full rating breakdown).
export interface RestaurantDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryCode: RestaurantCategoryCode;
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
  compositeScore: number | null;
  reviewCount: number;
  reviews: ReviewDto[];
  aiSummary: null;
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
