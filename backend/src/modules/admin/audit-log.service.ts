import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    // Round-trips through JSON to strip non-serializable values (Decimal,
    // Date instances, etc.) into plain JSON — Prisma's JSONB column needs
    // exactly that, not raw driver types.
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
