import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class AuditLogQueryDto {
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
