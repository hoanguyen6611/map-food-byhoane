import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { CuisineCode, FacilityType, PriceRangeCode, RestaurantCategoryCode } from '@foodmap/shared-types';

const CATEGORY_CODES: RestaurantCategoryCode[] = ['quan_an', 'quan_ca_phe', 'nha_hang', 'xe_day', 'quan_via_he', 'quan_bar'];
const PRICE_RANGE_CODES: PriceRangeCode[] = ['under_50k', '50_100k', '100_200k', '200_500k', 'above_500k'];
const CUISINE_CODES: CuisineCode[] = ['mon_viet', 'mon_han', 'mon_nhat', 'mon_chay', 'mon_thai', 'mon_au'];
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
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// A much higher hard ceiling than the admin flow's trusted-input cap
// (10,000,000₫) — community submissions aren't trusted, so genuinely
// implausible values (typo'd extra zeros, garbage) are rejected outright,
// while anything ≥10M (still possible for a real high-end tasting menu) is
// instead FLAGGED for moderator review by ContributionModerationService
// rather than hard-rejected. See rule-based-moderation's abnormal_price check.
const MAX_SANE_PRICE_VND = 50_000_000;

export class ContributionAddressDto {
  @IsString()
  @MaxLength(255)
  line!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @IsString()
  @MaxLength(100)
  district!: string;

  @IsString()
  @MaxLength(100)
  province!: string;
}

export class ContributionLocationDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}

export class ContributionOpeningHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'openTime must be HH:mm (24h)' })
  openTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'closeTime must be HH:mm (24h)' })
  closeTime?: string | null;

  @IsBoolean()
  isClosed!: boolean;
}

export class ContributionMenuItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_SANE_PRICE_VND)
  priceVnd!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;
}

export class CreateRestaurantContributionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  @Type(() => ContributionAddressDto)
  address!: ContributionAddressDto;

  @ValidateNested()
  @Type(() => ContributionLocationDto)
  location!: ContributionLocationDto;

  @IsOptional()
  @IsArray()
  @IsIn(CUISINE_CODES, { each: true })
  cuisineCodes?: CuisineCode[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContributionOpeningHourDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  openingHours?: ContributionOpeningHourDto[];

  @IsOptional()
  @IsArray()
  @IsIn(FACILITY_TYPES, { each: true })
  facilities?: FacilityType[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContributionMenuItemDto)
  @ArrayMaxSize(100)
  menuItems?: ContributionMenuItemDto[];

  // ≥1 photo required per build-prompts/07's Add Restaurant scope.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photoIds!: string[];

  @IsOptional()
  @IsBoolean()
  duplicateConfirmed?: boolean;
}
