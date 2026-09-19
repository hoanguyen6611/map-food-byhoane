import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../revalidation/web-revalidation.service';
import { AuditLogService } from './audit-log.service';
import type { CreateCategoryDto } from './dto/category.dto';
import type { UpdateCategoryDto } from './dto/category.dto';

function toDto(row: { id: string; code: string; label: string; icon: string | null }): CategoryDto {
  return { id: row.id, code: row.code, label: row.label, icon: row.icon };
}

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async list(): Promise<CategoryDto[]> {
    const rows = await this.prisma.restaurantCategory.findMany({ orderBy: { label: 'asc' } });
    return rows.map(toDto);
  }

  async create(dto: CreateCategoryDto, actorId: string): Promise<CategoryDto> {
    const existing = await this.prisma.restaurantCategory.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException('Mã danh mục này đã tồn tại');
    }
    const created = await this.prisma.restaurantCategory.create({
      data: { code: dto.code, label: dto.label, icon: dto.icon },
    });
    await this.auditLog.record({
      actorId,
      action: 'category.create',
      targetType: 'category',
      targetId: created.id,
      afterState: dto,
    });
    void this.webRevalidation.revalidate(['categories']);
    return toDto(created);
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string): Promise<CategoryDto> {
    const before = await this.prisma.restaurantCategory.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const updated = await this.prisma.restaurantCategory.update({
      where: { id },
      data: {
        label: dto.label ?? undefined,
        icon: dto.icon ?? undefined,
      },
    });
    await this.auditLog.record({
      actorId,
      action: 'category.update',
      targetType: 'category',
      targetId: id,
      beforeState: { label: before.label, icon: before.icon },
      afterState: dto,
    });
    // A label/icon edit is embedded in every restaurant's cached
    // categoryLabel (search results + detail pages), not just /categories.
    void this.webRevalidation.revalidate(['categories', 'restaurants']);
    return toDto(updated);
  }

  /**
   * Blocks deletion while any restaurant (or review-criteria row) still
   * references this category — `Restaurant.categoryId` is a required,
   * `onDelete: Restrict` FK, so an unchecked delete would just surface as
   * an opaque Postgres FK-violation error; this gives a clear message and
   * count instead.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const category = await this.prisma.restaurantCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const inUse = await this.prisma.restaurant.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new BadRequestException(`Không thể xoá — đang được ${inUse} quán ăn sử dụng`);
    }
    await this.prisma.restaurantCategory.delete({ where: { id } });
    await this.auditLog.record({
      actorId,
      action: 'category.delete',
      targetType: 'category',
      targetId: id,
      beforeState: { code: category.code, label: category.label },
    });
    void this.webRevalidation.revalidate(['categories']);
  }
}
