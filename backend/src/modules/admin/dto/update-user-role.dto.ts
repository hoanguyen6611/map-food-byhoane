import { IsIn } from 'class-validator';
import type { RoleCode } from '@foodmap/shared-types';

const ROLE_CODES: RoleCode[] = ['guest', 'user', 'moderator', 'admin', 'owner'];

export class UpdateUserRoleDto {
  @IsIn(ROLE_CODES)
  roleCode!: RoleCode;
}
