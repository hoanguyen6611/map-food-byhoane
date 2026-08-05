import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { ReportReason, ReportTargetType } from '@foodmap/shared-types';

const TARGET_TYPES: ReportTargetType[] = ['restaurant', 'review'];
const REASONS: ReportReason[] = ['spam', 'inappropriate', 'incorrect_info', 'duplicate', 'closed_down', 'other'];

export class CreateReportDto {
  @IsIn(TARGET_TYPES)
  targetType!: ReportTargetType;

  @IsUUID()
  targetId!: string;

  @IsIn(REASONS)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
