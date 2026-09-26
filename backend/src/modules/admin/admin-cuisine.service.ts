import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CuisineDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../revalidation/web-revalidation.service';
import { AuditLogService } from './audit-log.service';
import type { CreateCuisineDto } from './dto/cuisine.dto';
import type { UpdateCuisineDto } from './dto/cuisine.dto';

function toDto(row: { id: string; code: string; label: string; isPublic: boolean }): CuisineDto {
  return { id: row.id, code: row.code, label: row.label, isPublic: row.isPublic };
}

@Injectable()
export class AdminCuisineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async list(): Promise<CuisineDto[]> {
    const rows = await this.prisma.cuisine.findMany({ orderBy: { label: 'asc' } });
    return rows.map(toDto);
  }

  async create(dto: CreateCuisineDto, actorId: string): Promise<CuisineDto> {
    const existing = await this.prisma.cuisine.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException('Mã ẩm thực này đã tồn tại');
    }
    const created = await this.prisma.cuisine.create({
      data: { code: dto.code, label: dto.label },
    });
    await this.auditLog.record({
      actorId,
      action: 'cuisine.create',
      targetType: 'cuisine',
      targetId: created.id,
      afterState: dto,
    });
    void this.webRevalidation.revalidate(['cuisines']);
    return toDto(created);
  }

  async update(id: string, dto: UpdateCuisineDto, actorId: string): Promise<CuisineDto> {
    const before = await this.prisma.cuisine.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('Không tìm thấy ẩm thực');
    }
    const updated = await this.prisma.cuisine.update({
      where: { id },
      data: { label: dto.label ?? undefined, isPublic: dto.isPublic ?? undefined },
    });
    await this.auditLog.record({
      actorId,
      action: 'cuisine.update',
      targetType: 'cuisine',
      targetId: id,
      beforeState: { label: before.label, isPublic: before.isPublic },
      afterState: dto,
    });
    void this.webRevalidation.revalidate(['cuisines']);
    return toDto(updated);
  }

  /**
   * Blocks deletion while any restaurant still has this cuisine assigned, or
   * any Dish still references it — both are required FKs to Cuisine.id, so
   * an unchecked delete would just surface as an opaque Postgres
   * FK-violation error otherwise.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const cuisine = await this.prisma.cuisine.findUnique({ where: { id } });
    if (!cuisine) {
      throw new NotFoundException('Không tìm thấy ẩm thực');
    }
    const [restaurantCount, dishCount] = await Promise.all([
      this.prisma.restaurantCuisine.count({ where: { cuisineId: id } }),
      this.prisma.dish.count({ where: { cuisineId: id } }),
    ]);
    const inUse = restaurantCount + dishCount;
    if (inUse > 0) {
      throw new BadRequestException(`Không thể xoá — đang được ${inUse} quán ăn/món ăn sử dụng`);
    }
    await this.prisma.cuisine.delete({ where: { id } });
    await this.auditLog.record({
      actorId,
      action: 'cuisine.delete',
      targetType: 'cuisine',
      targetId: id,
      beforeState: { code: cuisine.code, label: cuisine.label },
    });
    void this.webRevalidation.revalidate(['cuisines']);
  }
}
