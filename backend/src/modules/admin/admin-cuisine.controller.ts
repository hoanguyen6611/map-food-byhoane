import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CuisineDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminCuisineService } from './admin-cuisine.service';
import { CreateCuisineDto, UpdateCuisineDto } from './dto/cuisine.dto';

// `admin` and `moderator` share list/create/update; delete is admin-only —
// same split as AdminCategoryController/AdminFacilityController.
@ApiTags('Admin: Cuisines')
@ApiBearerAuth('access-token')
@Controller('admin/cuisines')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminCuisineController {
  constructor(private readonly adminCuisineService: AdminCuisineService) {}

  @Get()
  list(): Promise<CuisineDto[]> {
    return this.adminCuisineService.list();
  }

  @Post()
  create(@Body() dto: CreateCuisineDto, @CurrentUser() user: RequestUser): Promise<CuisineDto> {
    return this.adminCuisineService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCuisineDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CuisineDto> {
    return this.adminCuisineService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.adminCuisineService.remove(id, user.id);
  }
}
