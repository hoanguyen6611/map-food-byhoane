import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { RoleCode, UserStatus } from '@foodmap/shared-types';

const ROLE_CODES: RoleCode[] = ['guest', 'user', 'moderator', 'admin', 'owner'];
const STATUSES: UserStatus[] = ['active', 'suspended', 'deleted'];

export class AdminUserQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ROLE_CODES)
  role?: RoleCode;

  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;

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
