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
    const rows = await this.prisma.facility.findMany({ orderBy: { label: 'asc' } });
    return rows.map((r) => ({ id: r.id, code: r.code, label: r.label, icon: r.icon }));
  }

  async listCuisines(): Promise<CuisineDto[]> {
    const rows = await this.prisma.cuisine.findMany({ orderBy: { label: 'asc' } });
    return rows.map((r) => ({ id: r.id, code: r.code, label: r.label }));
  }
}
