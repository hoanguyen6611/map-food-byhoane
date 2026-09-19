import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  CuisineCode,
  PriceRangeCode,
  RestaurantCategoryCode,
} from '@foodmap/shared-types';

const PRICE_RANGE_CODES: PriceRangeCode[] = [
  'under_50k',
  '50_100k',
  '100_200k',
  '200_500k',
  'above_500k',
];

export class AddressInputDto {
  @IsString()
  @MaxLength(255)
  line!: string;

  @IsString()
  @MaxLength(100)
  ward!: string;

  // District was eliminated from Vietnam's administrative hierarchy in
  // 2025 — no longer collected from any client. Kept optional (rather than
  // removed) purely so legacy callers/tests aren't broken; new writes
  // always omit it and the service layer defaults it to ''.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsString()
  @MaxLength(100)
  province!: string;
}

export class LocationInputDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  categoryCode!: RestaurantCategoryCode;

  @IsOptional()
  @IsIn(PRICE_RANGE_CODES)
  priceRangeCode?: PriceRangeCode;

  @IsOptional()
  @IsPhoneNumber('VN')
  phone?: string;

  @ValidateNested()
  @Type(() => AddressInputDto)
  address!: AddressInputDto;

  @ValidateNested()
  @Type(() => LocationInputDto)
  location!: LocationInputDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineCodes?: CuisineCode[];

  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @IsOptional()
  @IsBoolean()
  facebookVerified?: boolean;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsBoolean()
  instagramVerified?: boolean;

  @IsOptional()
  @IsUrl()
  tiktokUrl?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}
