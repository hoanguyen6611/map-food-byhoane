import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { AdminUserDetailDto, AdminUserListItemDto, Paginated } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminUserService } from './admin-user.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

// Gap-fix per docs/build-prompts/08 — see admin-user.service.ts's doc
// comment. `admin`/`moderator` can both list; suspend/reactivate/role-change
// are admin-only (moderator gets 403), matching the Security Checklist item
// and the PRD §10.11 business rule verbatim.
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  list(@Query() query: AdminUserQueryDto): Promise<Paginated<AdminUserListItemDto>> {
    return this.adminUserService.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminUserDetailDto> {
    return this.adminUserService.detail(id);
  }

  @Patch(':id/suspend')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.adminUserService.suspend(id, user.id);
  }

  @Patch(':id/reactivate')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.adminUserService.reactivate(id, user.id);
  }

  @Patch(':id/role')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.adminUserService.changeRole(id, dto.roleCode, user.id);
  }
}
