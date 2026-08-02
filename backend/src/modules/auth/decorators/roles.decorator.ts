import { SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@foodmap/shared-types';

export const ROLES_KEY = 'roles';

// Coarse-grained gate ("is this user an admin or moderator at all") — for
// fine-grained action checks (e.g. "can this moderator delete a restaurant")
// use @RequirePermissions instead. Both are usable by later modules per
// docs/build-prompts/02-auth.md.
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
