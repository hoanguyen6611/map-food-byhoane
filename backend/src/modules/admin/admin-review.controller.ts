import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AdminReviewListItemDto, Paginated } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminReviewService } from './admin-review.service';
import { AdminReviewQueryDto } from './dto/admin-review-query.dto';

// Admin Review Management (docs/04-screen-list.md §32). `admin`/`moderator`
// can both browse; hide/restore/delete are admin-only per the screen spec's
// "(chỉ admin)" note — mirrors AdminUserController's split.
@ApiTags('Admin: Reviews')
@ApiBearerAuth('access-token')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminReviewController {
  constructor(private readonly adminReviewService: AdminReviewService) {}

  @Get()
  list(@Query() query: AdminReviewQueryDto): Promise<Paginated<AdminReviewListItemDto>> {
    return this.adminReviewService.list(query);
  }

  @Patch(':id/hide')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.adminReviewService.hide(id, user.id);
  }

  @Patch(':id/restore')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.adminReviewService.restore(id, user.id);
  }

  // "Xoá vĩnh viễn" requires 2-step confirmation per the screen spec — a
  // client-side UX concern (confirm dialog), not something the API needs to
  // enforce separately.
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    await this.adminReviewService.remove(id, user.id);
  }
}
