import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUserDetailDto, AdminUserListItemDto, Paginated, RoleCode, UserStatus } from '@foodmap/shared-types';
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
      // Spec (screen 33) says "tìm kiếm theo email/tên" — OR across both,
      // not just email.
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { profile: { displayName: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
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

  // Screen 33's "chi tiết hoạt động" panel — fetched only when an admin opens
  // one user's detail view, so the list endpoint stays cheap. reportsReceivedCount
  // is derived via the user's reviews since Report has no direct 'user' target
  // type (see ReportTargetType in shared-types).
  async detail(targetUserId: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, include: { role: true, profile: true } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const reviews = await this.prisma.review.findMany({
      where: { userId: targetUserId, deletedAt: null },
      select: { id: true },
    });
    const reportsReceivedCount = reviews.length
      ? await this.prisma.report.count({ where: { targetType: 'review', targetId: { in: reviews.map((r) => r.id) } } })
      : 0;

    return {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      roleCode: user.role.code as RoleCode,
      status: user.status as UserStatus,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      reviewCount: reviews.length,
      reportsReceivedCount,
    };
  }

  // Admin-only per the RBAC checklist item — enforced by RolesGuard on the
  // controller, not re-checked here.
  async suspend(targetUserId: string, actorId: string): Promise<void> {
    if (targetUserId === actorId) {
      // Validation per screen 33: "Không thể tự khoá chính mình" — with no
      // second-admin-invite flow in this MVP, self-suspension has no recovery path.
      throw new BadRequestException('Không thể tự khoá chính mình');
    }
    await this.assertNotLastActiveAdmin(targetUserId, 'Không thể khoá admin cuối cùng của hệ thống');
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
    if (user.role.code === 'admin' && roleCode !== 'admin') {
      await this.assertNotLastActiveAdmin(targetUserId, 'Không thể đổi vai trò của admin cuối cùng của hệ thống');
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

  // Validation per screen 33: "không thể xoá [quyền của] admin cuối cùng của
  // hệ thống" — covers both suspending and role-demoting the sole remaining
  // active admin. No-ops for anyone who isn't currently an active admin.
  private async assertNotLastActiveAdmin(targetUserId: string, message: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, include: { role: true } });
    if (!target || target.role.code !== 'admin' || target.status !== 'active') {
      return;
    }
    const activeAdminCount = await this.prisma.user.count({ where: { role: { code: 'admin' }, status: 'active' } });
    if (activeAdminCount <= 1) {
      throw new BadRequestException(message);
    }
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
