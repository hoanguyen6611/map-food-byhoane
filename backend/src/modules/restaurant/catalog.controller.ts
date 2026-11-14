import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  CategoryDto,
  CuisineDto,
  DistrictSummaryDto,
  FacilityDto,
  NearestProvinceDto,
  ProvinceSummaryDto,
} from '@foodmap/shared-types';
import { CatalogService } from './catalog.service';
import { SearchService } from '../search/search.service';

// Public, unauthenticated — categories/facilities/cuisines are admin-editable
// (AdminCategoryController/AdminFacilityController/AdminCuisineController)
// but reading the live list back is exactly as public as e.g.
// GET /restaurants/:id; web, admin-web's own restaurant-edit form, and
// mobile all read from here instead of a hardcoded label list going stale
// the moment an admin adds a new one.
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly searchService: SearchService,
  ) {}

  @Get('categories')
  listCategories(): Promise<CategoryDto[]> {
    return this.catalogService.listCategories();
  }

  @Get('facilities')
  listFacilities(): Promise<FacilityDto[]> {
    return this.catalogService.listFacilities();
  }

  @Get('cuisines')
  listCuisines(): Promise<CuisineDto[]> {
    return this.catalogService.listCuisines();
  }

  /** Districts (stored or parsed from the address) that have published restaurants, with counts. */
  @Get('districts')
  listDistricts(@Query('province') province?: string): Promise<DistrictSummaryDto[]> {
    return this.searchService.listDistricts(province?.trim() || undefined);
  }

  /** Provinces that have published restaurants, with counts. */
  @Get('provinces')
  listProvinces(): Promise<ProvinceSummaryDto[]> {
    return this.searchService.listProvinces();
  }

  /** Province of the closest published restaurant (≤150 km) — "Dùng vị trí hiện tại". */
  @Get('provinces/nearest')
  findNearestProvince(@Query('lat') lat?: string, @Query('lng') lng?: string): Promise<NearestProvinceDto> {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!lat || !lng || !Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      throw new BadRequestException('lat and lng must be valid coordinates');
    }
    return this.searchService.findNearestProvince(latNum, lngNum);
  }
}
