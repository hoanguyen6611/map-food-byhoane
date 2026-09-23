import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditLogEntryDto, Paginated } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface RecordAuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * Shared audit-logging mechanism, per docs/build-prompts/05's requirement
 * ("implement this... now since every later admin module reuses the same
 * pattern"). Implemented as an injectable service called explicitly at each
 * mutation site — not a generic interceptor — because a generic interceptor
 * can't know what "before/after state" means for an arbitrary entity without
 * either reflection magic or the caller doing the diffing anyway; an explicit
 * call is exactly as reusable (one shared `record()` method, every admin
 * module imports `AdminAuditModule`) while staying simple to read and test.
 * AuditLog is append-only per docs/06-database-erd.md — no update/delete
 * method exists here on purpose.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        beforeState: this.toJson(input.beforeState),
        afterState: this.toJson(input.afterState),
      },
    });
  }

  /**
   * "Hoạt động gần đây" on the Admin Dashboard — read-only, does not affect
   * the append-only write contract above. Ordered newest first; the actor's
   * email is joined in since a raw `actorId` UUID isn't useful to display.
   */
  async list(params: { page?: number; pageSize?: number }): Promise<Paginated<AuditLogEntryDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);

    const items: AuditLogEntryDto[] = rows.map((row) => ({
      id: row.id,
      actorEmail: row.actor.email,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    // Round-trips through JSON to strip non-serializable values (Decimal,
    // Date instances, etc.) into plain JSON — Prisma's JSONB column needs
    // exactly that, not raw driver types.
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
