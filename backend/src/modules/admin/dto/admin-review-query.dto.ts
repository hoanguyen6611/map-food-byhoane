import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { ReviewStatus } from '@foodmap/shared-types';

const STATUSES: ReviewStatus[] = ['pending', 'published', 'rejected', 'hidden'];

export class AdminReviewQueryDto {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: ReviewStatus;

  // Reviews with no ModerationResult yet (riskScore === null) are excluded
  // when this filter is set — there's nothing to compare against.
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  minRiskScore?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
