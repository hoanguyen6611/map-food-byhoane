import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClosePermanentlyDto {
  /** Optional admin note (e.g. "3 báo cáo đóng cửa, đã gọi xác nhận") — goes to the audit log only. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
