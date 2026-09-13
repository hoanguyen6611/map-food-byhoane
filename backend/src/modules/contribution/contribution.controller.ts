import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ContributionListResponse,
  CreateEditSuggestionResponse,
  CreateRestaurantContributionResponse,
  CreateStatusReportResponse,
  DuplicateCheckResponse,
} from '@foodmap/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { RateLimit } from '../auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { ContributionService } from './contribution.service';
import { DuplicateCheckDto } from './dto/duplicate-check.dto';
import { CreateRestaurantContributionDto } from './dto/create-restaurant-contribution.dto';
import { CreateEditSuggestionDto } from './dto/edit-suggestion.dto';
import { CreateStatusReportDto } from './dto/status-report.dto';
import { ContributionListQueryDto } from './dto/contribution-list-query.dto';

// Community-facing contribution flow (build-prompts/07) — distinct from
// Module 5's admin-facing /admin/restaurants create. Any authenticated user
// (role 'user') may submit; no @Roles restriction anywhere here.
@ApiTags('Contributions')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class ContributionController {
  constructor(private readonly contributionService: ContributionService) {}

  @Post('restaurants/duplicate-check')
  async duplicateCheck(@Body() dto: DuplicateCheckDto): Promise<DuplicateCheckResponse> {
    const candidates = await this.contributionService.checkDuplicate(dto.lat, dto.lng, dto.name);
    return { candidates };
  }

  // Rate-limited per the review-creation precedent (docs/09-testing-plan.md
  // §4 Security Checklist) — a new-restaurant submission is a much heavier
  // abuse vector than a review, so this is the same 10/hour/user shape.
  @Post('restaurants')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 3600, keyPrefix: 'contribution-create' })
  createRestaurant(
    @Body() dto: CreateRestaurantContributionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateRestaurantContributionResponse> {
    return this.contributionService.createNewRestaurant(dto, user.id);
  }

  @Post('restaurants/:id/edit-suggestions')
  createEditSuggestion(
    @Param('id') id: string,
    @Body() dto: CreateEditSuggestionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateEditSuggestionResponse> {
    return this.contributionService.createEditSuggestion(id, dto, user.id);
  }

  // Closure reports specifically are rate-limited — the escalation rule
  // (3 distinct reporters/14 days) is an abuse vector for fake escalation
  // if a single account could spam unlimited reports.
  @Post('restaurants/:id/status-reports')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 3600, keyPrefix: 'status-report-create' })
  createStatusReport(
    @Param('id') id: string,
    @Body() dto: CreateStatusReportDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateStatusReportResponse> {
    return this.contributionService.createStatusReport(id, dto, user.id);
  }

  @Get('me/contributions')
  listMine(@CurrentUser() user: RequestUser, @Query() query: ContributionListQueryDto): Promise<ContributionListResponse> {
    return this.contributionService.listMyContributions(user.id, query.page, query.pageSize);
  }

  @Get('contributions/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contributionService.getContribution(id, user.id);
  }
}
