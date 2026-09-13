import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AdminDashboardStatsDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

// Read-only aggregated stats (docs/04-screen-list.md §29) — both `admin` and
// `moderator` get it, same as the Moderation Queue, no method-level @Roles
// override.
@ApiTags('Admin: Dashboard')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('dashboard')
  getStats(): Promise<AdminDashboardStatsDto> {
    return this.adminDashboardService.getStats();
  }
}
