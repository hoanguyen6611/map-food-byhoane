import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { CuisineCode, FacilityType } from '@foodmap/shared-types';

const FACILITY_TYPES: FacilityType[] = [
  'wifi',
  'parking_car',
  'parking_motorbike',
  'air_conditioner',
  'outdoor_seating',
  'kid_friendly',
  'pet_friendly',
  'card_payment',
  'private_room',
];

const CUISINE_CODES: CuisineCode[] = [
  'mon_viet',
  'mon_han',
  'mon_nhat',
  'mon_chay',
  'mon_thai',
  'mon_au',
];

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
  @IsIn(FACILITY_TYPES, { each: true })
  facilities?: FacilityType[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsIn(CUISINE_CODES, { each: true })
  cuisine?: CuisineCode[];

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
