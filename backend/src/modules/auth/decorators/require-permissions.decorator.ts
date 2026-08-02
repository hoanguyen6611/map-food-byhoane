import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Fine-grained action check, e.g. @RequirePermissions('restaurant.delete').
// Codes match the `Permission.code` catalog seeded in prisma/seed.ts.
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
