import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { ReviewCriteriaCode } from '@foodmap/shared-types';

export const REVIEW_CRITERIA_CODES: ReviewCriteriaCode[] = [
  'food_quality',
  'space',
  'price',
  'service',
  'hygiene',
  'wifi',
  'parking',
];

export class ReviewRatingInputDto {
  @IsIn(REVIEW_CRITERIA_CODES)
  criteriaCode!: ReviewCriteriaCode;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}
