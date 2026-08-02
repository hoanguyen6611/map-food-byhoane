import type { RoleCode } from '@foodmap/shared-types';

export interface JwtPayload {
  sub: string; // userId
  role: RoleCode;
  roleId: string;
}

export interface RequestUser {
  id: string;
  roleId: string;
  role: RoleCode;
}
