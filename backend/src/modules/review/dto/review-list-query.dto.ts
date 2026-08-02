import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ReviewSort } from '@foodmap/shared-types';

const SORTS: ReviewSort[] = ['newest', 'most_helpful', 'has_photos'];

export class ReviewListQueryDto {
  @IsOptional()
  @IsIn(SORTS)
  sort?: ReviewSort;

  // "filter=" per docs/build-prompts/06's route shape — interpreted as an
  // exact overallRating filter (e.g. filter=5 shows only 5-star reviews),
  // the standard "lọc theo số sao" review-UI pattern.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  filter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
