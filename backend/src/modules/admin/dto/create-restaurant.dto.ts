import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { CuisineCode, PriceRangeCode, RestaurantCategoryCode } from '@foodmap/shared-types';

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
const CUISINE_CODES: CuisineCode[] = ['mon_viet', 'mon_han', 'mon_nhat', 'mon_chay', 'mon_thai', 'mon_au'];

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

  @IsIn(CATEGORY_CODES)
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
  @IsIn(CUISINE_CODES, { each: true })
  cuisineCodes?: CuisineCode[];
}
