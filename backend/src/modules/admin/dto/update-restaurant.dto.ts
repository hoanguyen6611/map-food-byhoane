import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
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
import { AddressInputDto, LocationInputDto } from './create-restaurant.dto';

const PRICE_RANGE_CODES: PriceRangeCode[] = [
  'under_50k',
  '50_100k',
  '100_200k',
  '200_500k',
  'above_500k',
];

// All fields optional (PATCH semantics) — nested address/location, when
// provided, must still be complete objects (partial-address updates aren't
// supported; admin-web always submits the full form).
export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryCode?: RestaurantCategoryCode;

  @IsOptional()
  @IsIn(PRICE_RANGE_CODES)
  priceRangeCode?: PriceRangeCode;

  @IsOptional()
  @IsPhoneNumber('VN')
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  address?: AddressInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInputDto)
  location?: LocationInputDto;

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
