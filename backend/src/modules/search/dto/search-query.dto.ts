import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type {
  CuisineCode,
  FacilityType,
  RestaurantCategoryCode,
} from '@foodmap/shared-types';

// Shared by GET /search (q optional-but-usually-present) and GET /restaurants
// (browse, q always absent) per docs/build-prompts/04-search-filter.md — one
// DTO, two controller methods.
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  // Not capped with @Max here for the same reason as build-prompts/03's
  // NearbyQueryDto: SearchService clamps to 20km itself so the behavior is
  // "silently capped", never a 400, regardless of what's requested.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  distanceKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  // Cross-field validation (priceMin <= priceMax) happens in SearchService,
  // not here — class-validator cross-field checks are awkward for query DTOs
  // and the PRD's exact wording ("priceMin <= priceMax" business rule) reads
  // more clearly as an explicit service-level check with a clear error message.
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  openNow?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  facilities?: FacilityType[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  cuisine?: CuisineCode[];

  // Added for build-prompts/09-public-web.md's category/district browse
  // chips — a gap in the original build-prompts/04-search-filter.md scope
  // (only cuisine/facilities were filterable, not the restaurant's own
  // category or its address district), generically useful for mobile too.
  @IsOptional()
  @IsString()
  category?: RestaurantCategoryCode;

  @IsOptional()
  @IsString()
  district?: string;

  // Exact-match filters against Address.province/Address.ward, populated by
  // the Province+Ward select added to restaurant creation (vn-address.ts).
  // `ward` alone is ambiguous (short ward names repeat across provinces) —
  // the client is expected to always send `province` alongside it, but each
  // condition is applied independently for simplicity.
  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
