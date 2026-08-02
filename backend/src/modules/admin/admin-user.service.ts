import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUserListItemDto, Paginated, RoleCode, UserStatus } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import type { AdminUserQueryDto } from './dto/admin-user-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

// Gap-fix per docs/build-prompts/08-favorites-notifications-polish.md: PRD
// §10.11 ("manage users (suspend/ban)") and the Security Checklist's "RBAC:
// moderator blocked from admin-only actions (user ban, role change)" item
// were never actually implemented by any of Modules 1-8's original scope —
// this should have landed alongside the rest of Module 5's Admin Portal
// work but was missed. API-only; no admin-web UI added for this (the
// existing AdminUserManagementPage placeholder is untouched) since the
// Security Checklist only requires RBAC enforcement "at the API layer, not
// just hidden in UI" — a UI is a reasonable follow-up, not required here.
@Injectable()
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: AdminUserQueryDto): Promise<Paginated<AdminUserListItemDto>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: { code: query.role } } : {}),
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { role: true, profile: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.profile?.displayName ?? null,
        roleCode: u.role.code as RoleCode,
        status: u.status as UserStatus,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  // Admin-only per the RBAC checklist item — enforced by RolesGuard on the
  // controller, not re-checked here.
  async suspend(targetUserId: string, actorId: string): Promise<void> {
    await this.setStatus(targetUserId, 'suspended', actorId, 'user.suspend');
  }

  async reactivate(targetUserId: string, actorId: string): Promise<void> {
    await this.setStatus(targetUserId, 'active', actorId, 'user.reactivate');
  }

  async changeRole(targetUserId: string, roleCode: RoleCode, actorId: string): Promise<void> {
    if (targetUserId === actorId) {
      // An admin demoting themselves could lock themselves out with no
      // recovery path in this MVP (no second admin-invite flow exists) —
      // block it rather than build that recovery flow now.
      throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, include: { role: true } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException(`Vai trò không hợp lệ: ${roleCode}`);
    }

    await this.prisma.user.update({ where: { id: targetUserId }, data: { roleId: role.id } });
    await this.auditLog.record({
      actorId,
      action: 'user.role_change',
      targetType: 'user',
      targetId: targetUserId,
      beforeState: { roleCode: user.role.code },
      afterState: { roleCode },
    });
  }

  private async setStatus(targetUserId: string, status: UserStatus, actorId: string, action: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    await this.prisma.user.update({ where: { id: targetUserId }, data: { status } });
    await this.auditLog.record({
      actorId,
      action,
      targetType: 'user',
      targetId: targetUserId,
      beforeState: { status: user.status },
      afterState: { status },
    });
  }
}
