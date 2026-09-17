import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
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

const CATEGORY_CODES: RestaurantCategoryCode[] = [
  'quan_an',
  'quan_ca_phe',
  'nha_hang',
  'xe_day',
  'quan_via_he',
  'quan_bar',
];
const PRICE_RANGE_CODES: PriceRangeCode[] = [
  'under_50k',
  '50_100k',
  '100_200k',
  '200_500k',
  'above_500k',
];
const CUISINE_CODES: CuisineCode[] = [
  'mon_viet',
  'mon_han',
  'mon_nhat',
  'mon_chay',
  'mon_thai',
  'mon_au',
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
  @IsIn(CATEGORY_CODES)
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
  @IsIn(CUISINE_CODES, { each: true })
  cuisineCodes?: CuisineCode[];
}
