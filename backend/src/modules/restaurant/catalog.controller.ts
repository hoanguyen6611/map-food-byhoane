import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CategoryDto, CuisineDto, FacilityDto } from '@foodmap/shared-types';
import { CatalogService } from './catalog.service';

// Public, unauthenticated — categories/facilities/cuisines are admin-editable
// (AdminCategoryController/AdminFacilityController/AdminCuisineController)
// but reading the live list back is exactly as public as e.g.
// GET /restaurants/:id; web, admin-web's own restaurant-edit form, and
// mobile all read from here instead of a hardcoded label list going stale
// the moment an admin adds a new one.
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

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
}
