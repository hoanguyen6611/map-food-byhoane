import { Injectable } from '@nestjs/common';
import type { CategoryDto, CuisineDto, FacilityDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.restaurantCategory.findMany({ orderBy: { label: 'asc' } });
    return rows.map((r) => ({ id: r.id, code: r.code, label: r.label, icon: r.icon }));
  }

  async listFacilities(): Promise<FacilityDto[]> {
    // Excludes a contributor's still-pending "+ Thêm mới" facility (see
    // ContributionService.toCatalogCode) until the restaurant that
    // proposed it is approved.
    const rows = await this.prisma.facility.findMany({
      where: { isPublic: true },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, code: r.code, label: r.label, icon: r.icon, isPublic: r.isPublic }));
  }

  async listCuisines(): Promise<CuisineDto[]> {
    // Same isPublic gating as listFacilities above.
    const rows = await this.prisma.cuisine.findMany({
      where: { isPublic: true },
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, code: r.code, label: r.label, isPublic: r.isPublic }));
  }
}
