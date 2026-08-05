import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminModerationQueueItemDto, Paginated, ReportDto } from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminModerationService } from './admin-moderation.service';
import { ReportService } from '../moderation/report.service';
import { AdminModerationQueryDto } from './dto/admin-moderation-query.dto';
import { ModerationDecisionDto } from './dto/moderation-decision.dto';
import { ResolveReportDto } from '../moderation/dto/resolve-report.dto';

// Both `admin` and `moderator` can list/decide/resolve here — no
// method-level @Roles override, unlike AdminRestaurantController's hard
// delete (per build-prompts/07: moderators fully own this queue).
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminModerationController {
  constructor(
    private readonly adminModerationService: AdminModerationService,
    private readonly reportService: ReportService,
  ) {}

  @Get('moderation-queue')
  list(@Query() query: AdminModerationQueryDto): Promise<Paginated<AdminModerationQueueItemDto>> {
    return this.adminModerationService.list(query);
  }

  @Post('moderation-queue/:id/decision')
  @HttpCode(HttpStatus.NO_CONTENT)
  decide(
    @Param('id') id: string,
    @Body() dto: ModerationDecisionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.adminModerationService.decide(id, dto, user.id);
  }

  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ReportDto> {
    return this.reportService.resolve(id, dto.status, user.id);
  }
}
