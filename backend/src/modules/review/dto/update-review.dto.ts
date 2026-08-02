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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReviewRatingInputDto } from './review-rating-input.dto';

// All fields optional (PATCH semantics); `ratings`, when provided, is a full
// replace of the criteria scores, not a partial merge (mirrors
// ReplaceFacilitiesDto's rationale in the admin module).
export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewRatingInputDto)
  ratings?: ReviewRatingInputDto[];

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
