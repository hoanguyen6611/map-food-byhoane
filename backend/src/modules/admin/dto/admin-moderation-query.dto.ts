import { Type } from 'class-transformer';
import { IsIn, IsOptional, Max, Min } from 'class-validator';
import type { ModerationDecision, ModerationTargetType } from '@foodmap/shared-types';

const TARGET_TYPES: ModerationTargetType[] = ['review', 'contribution', 'photo', 'video', 'restaurant'];
const DECISIONS: ModerationDecision[] = ['pending', 'approved', 'rejected', 'edit_requested'];

export class AdminModerationQueryDto {
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: ModerationTargetType;

  // Defaults to 'pending' in the service — the queue's whole point is
  // surfacing undecided items; an explicit status filter opts into history.
  @IsOptional()
  @IsIn(DECISIONS)
  decision?: ModerationDecision;

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
