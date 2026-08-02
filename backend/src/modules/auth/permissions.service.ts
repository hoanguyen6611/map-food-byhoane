import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CacheEntry {
  codes: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

// In-memory (per-process) cache of roleId -> permission codes, per
// docs/build-prompts/02-auth.md: "cached in-memory per request (or short-TTL
// Redis cache) to avoid a DB hit per permission check." A short TTL is
// sufficient here since RolePermission assignments change rarely (admin
// action, not user-facing), so eventual consistency within 60s is acceptable.
@Injectable()
export class PermissionsService {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getPermissionCodes(roleId: string): Promise<Set<string>> {
    const cached = this.cache.get(roleId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.codes;
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    const codes = new Set(rolePermissions.map((rp) => rp.permission.code));
    this.cache.set(roleId, { codes, expiresAt: Date.now() + CACHE_TTL_MS });
    return codes;
  }

  async hasPermission(
    roleId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const codes = await this.getPermissionCodes(roleId);
    return codes.has(permissionCode);
  }
}
