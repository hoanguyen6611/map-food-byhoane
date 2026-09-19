import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FacilityDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminFacilityService } from './admin-facility.service';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';

// `admin` and `moderator` share list/create/update; delete is admin-only —
// same split as AdminRestaurantController's hard-delete.
@ApiTags('Admin: Facilities')
@ApiBearerAuth('access-token')
@Controller('admin/facilities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminFacilityController {
  constructor(private readonly adminFacilityService: AdminFacilityService) {}

  @Get()
  list(): Promise<FacilityDto[]> {
    return this.adminFacilityService.list();
  }

  @Post()
  create(@Body() dto: CreateFacilityDto, @CurrentUser() user: RequestUser): Promise<FacilityDto> {
    return this.adminFacilityService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDto,
    @CurrentUser() user: RequestUser,
  ): Promise<FacilityDto> {
    return this.adminFacilityService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.adminFacilityService.remove(id, user.id);
  }
}
