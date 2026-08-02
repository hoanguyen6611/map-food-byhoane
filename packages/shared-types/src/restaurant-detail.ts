// Contract for docs/build-prompts/05-restaurant-detail-admin-seed.md.
import type {
  CuisineCode,
  FacilityType,
  PriceRangeDto,
  RestaurantCategoryCode,
  RestaurantPublicationStatus,
} from './restaurant';

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

// `reviews`/`aiSummary` are always empty/null until build-prompts/06 and 07
// populate them — the contract is stable now so those modules don't need to
// change this shape, only fill in real values.
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
  reviews: unknown[];
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
