import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CategoryDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminCategoryService } from './admin-category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

// `admin` and `moderator` share list/create/update; delete is admin-only —
// same split as AdminRestaurantController's hard-delete.
@ApiTags('Admin: Categories')
@ApiBearerAuth('access-token')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  list(): Promise<CategoryDto[]> {
    return this.adminCategoryService.list();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: RequestUser): Promise<CategoryDto> {
    return this.adminCategoryService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CategoryDto> {
    return this.adminCategoryService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.adminCategoryService.remove(id, user.id);
  }
}
