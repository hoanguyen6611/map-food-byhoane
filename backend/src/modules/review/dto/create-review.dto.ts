import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReviewRatingInputDto } from './review-rating-input.dto';

export class CreateReviewDto {
  @IsUUID()
  restaurantId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  // "At least 1 criterion + overall rating required" per docs/01-prd-mvp.md §10.5.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewRatingInputDto)
  ratings!: ReviewRatingInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  dishesOrdered?: string[];

  // "≥0 and <50,000,000 VND sanity cap" per docs/01-prd-mvp.md §10.5.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(49_999_999)
  billTotalVnd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @IsOptional()
  @IsISO8601()
  visitedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  waitTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  wouldReturn?: boolean;
}
