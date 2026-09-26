import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FacilityDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../revalidation/web-revalidation.service';
import { AuditLogService } from './audit-log.service';
import type { CreateFacilityDto } from './dto/facility.dto';
import type { UpdateFacilityDto } from './dto/facility.dto';

function toDto(row: { id: string; code: string; label: string; icon: string | null; isPublic: boolean }): FacilityDto {
  return { id: row.id, code: row.code, label: row.label, icon: row.icon, isPublic: row.isPublic };
}

@Injectable()
export class AdminFacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async list(): Promise<FacilityDto[]> {
    const rows = await this.prisma.facility.findMany({ orderBy: { label: 'asc' } });
    return rows.map(toDto);
  }

  async create(dto: CreateFacilityDto, actorId: string): Promise<FacilityDto> {
    const existing = await this.prisma.facility.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException('Mã tiện ích này đã tồn tại');
    }
    const created = await this.prisma.facility.create({
      data: { code: dto.code, label: dto.label, icon: dto.icon },
    });
    await this.auditLog.record({
      actorId,
      action: 'facility.create',
      targetType: 'facility',
      targetId: created.id,
      afterState: dto,
    });
    void this.webRevalidation.revalidate(['facilities']);
    return toDto(created);
  }

  async update(id: string, dto: UpdateFacilityDto, actorId: string): Promise<FacilityDto> {
    const before = await this.prisma.facility.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }
    const updated = await this.prisma.facility.update({
      where: { id },
      data: {
        label: dto.label ?? undefined,
        icon: dto.icon ?? undefined,
        isPublic: dto.isPublic ?? undefined,
      },
    });
    await this.auditLog.record({
      actorId,
      action: 'facility.update',
      targetType: 'facility',
      targetId: id,
      beforeState: { label: before.label, icon: before.icon, isPublic: before.isPublic },
      afterState: dto,
    });
    void this.webRevalidation.revalidate(['facilities']);
    return toDto(updated);
  }

  /**
   * Blocks deletion while any restaurant still has this facility assigned
   * — RestaurantFacility.facilityCode is a required, `onDelete: Restrict`
   * FK (see the facilities-table migration), so an unchecked delete would
   * just surface as an opaque Postgres FK-violation error otherwise.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }
    const inUse = await this.prisma.restaurantFacility.count({ where: { facilityCode: facility.code } });
    if (inUse > 0) {
      throw new BadRequestException(`Không thể xoá — đang được ${inUse} quán ăn sử dụng`);
    }
    await this.prisma.facility.delete({ where: { id } });
    await this.auditLog.record({
      actorId,
      action: 'facility.delete',
      targetType: 'facility',
      targetId: id,
      beforeState: { code: facility.code, label: facility.label },
    });
    void this.webRevalidation.revalidate(['facilities']);
  }
}
