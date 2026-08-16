import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import type { RestaurantPublicationStatus } from '@foodmap/shared-types';

const STATUSES: RestaurantPublicationStatus[] = [
  'pending',
  'in_review',
  'published',
  'rejected',
  'hidden',
  'removed',
];

export class AdminRestaurantQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: RestaurantPublicationStatus;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number;
}
