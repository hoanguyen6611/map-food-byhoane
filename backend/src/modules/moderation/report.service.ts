import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ReportDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReportDto, reporterId: string): Promise<ReportDto> {
    try {
      const report = await this.prisma.report.create({
        data: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          description: dto.description,
        },
      });
      return this.toDto(report);
    } catch (error) {
      // Surfaces the (reporterId, targetType, targetId) unique constraint
      // as a clean, actionable error — "duplicate-report prevention
      // surfaced from the API's unique-constraint error" per the doc.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR_CODE) {
        throw new ConflictException('Bạn đã báo cáo nội dung này rồi');
      }
      throw error;
    }
  }

  async findByTarget(targetType: 'restaurant' | 'review', targetId: string): Promise<ReportDto[]> {
    const reports = await this.prisma.report.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((r) => this.toDto(r));
  }

  async resolve(reportId: string, status: 'resolved' | 'dismissed', actorId: string): Promise<ReportDto> {
    const existing = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolvedBy: actorId, resolvedAt: new Date() },
    });
    return this.toDto(updated);
  }

  private toDto(row: {
    id: string;
    reporterId: string;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    resolvedBy: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): ReportDto {
    return {
      id: row.id,
      reporterId: row.reporterId,
      targetType: row.targetType as ReportDto['targetType'],
      targetId: row.targetId,
      reason: row.reason as ReportDto['reason'],
      description: row.description,
      status: row.status as ReportDto['status'],
      resolvedBy: row.resolvedBy,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}
