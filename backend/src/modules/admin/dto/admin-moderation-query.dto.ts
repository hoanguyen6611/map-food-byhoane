import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, Max, Min } from 'class-validator';
import type {
  ModerationDecision,
  ModerationTargetType,
} from '@foodmap/shared-types';

const TARGET_TYPES: ModerationTargetType[] = [
  'review',
  'contribution',
  'photo',
  'video',
  'restaurant',
];
const DECISIONS: ModerationDecision[] = [
  'pending',
  'approved',
  'rejected',
  'edit_requested',
];

export class AdminModerationQueryDto {
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: ModerationTargetType;

  // Defaults to 'pending' in the service — the queue's whole point is
  // surfacing undecided items; an explicit status filter opts into history.
  @IsOptional()
  @IsIn(DECISIONS)
  decision?: ModerationDecision;

  // Deep-linked from the Dashboard's "Báo cáo mới" KPI card — narrows the
  // queue to rows whose target has at least one open/escalated Report
  // (matched by targetType+targetId, the only link Report<->ModerationResult
  // has — see ReportService.ensureQueueVisible's doc comment).
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasReports?: boolean;

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
