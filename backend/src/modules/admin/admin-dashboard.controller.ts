import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AdminDashboardStatsDto, AuditLogEntryDto, Paginated } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

// Read-only aggregated stats (docs/04-screen-list.md §29) — both `admin` and
// `moderator` get it, same as the Moderation Queue, no method-level @Roles
// override.
@ApiTags('Admin: Dashboard')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('dashboard')
  getStats(): Promise<AdminDashboardStatsDto> {
    return this.adminDashboardService.getStats();
  }

  // "Hoạt động gần đây" feed on the Dashboard — a thin read over the
  // already-existing, already-populated AuditLog table (every admin mutation
  // across restaurants/moderation/users has been writing to it all along;
  // nothing surfaced it until now).
  @Get('audit-log')
  listAuditLog(@Query() query: AuditLogQueryDto): Promise<Paginated<AuditLogEntryDto>> {
    return this.auditLogService.list(query);
  }
}
