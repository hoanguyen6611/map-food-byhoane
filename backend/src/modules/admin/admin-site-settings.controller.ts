import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SITE_SETTING_KEYS, type SiteSettingKey, type SiteSettingsDto } from '@foodmap/shared-types';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { CompositeScoreService } from '../review/composite-score.service';
import { WebRevalidationService } from '../revalidation/web-revalidation.service';
import { AuditLogService } from './audit-log.service';

// Moderators can read (the page shows them the current values); only
// admins can change content and — more importantly — scoring rules.
@ApiTags('Admin: Site settings')
@ApiBearerAuth('access-token')
@Controller('admin/site-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
export class AdminSiteSettingsController {
  constructor(
    private readonly siteSettings: SiteSettingsService,
    private readonly compositeScore: CompositeScoreService,
    private readonly webRevalidation: WebRevalidationService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  getAll(): Promise<SiteSettingsDto> {
    return this.siteSettings.getAll();
  }

  @Put(':key')
  @Roles('admin')
  async update(
    @Param('key') key: string,
    @Body() body: { value?: unknown },
    @CurrentUser() user: RequestUser,
  ): Promise<SiteSettingsDto> {
    if (!SITE_SETTING_KEYS.includes(key as SiteSettingKey)) throw new BadRequestException('Cài đặt không tồn tại');
    const k = key as SiteSettingKey;
    const before = await this.siteSettings.get(k);
    const after = await this.siteSettings.update(k, body?.value, user.id);

    // Restaurant scores are stored, not computed per request — a new
    // threshold only shows once every restaurant is recomputed.
    if (k === 'scoring' && JSON.stringify(before) !== JSON.stringify(after)) {
      await this.compositeScore.enqueueReconcileAll();
    }
    await this.auditLog.record({
      actorId: user.id,
      action: `site_settings.update.${k}`,
      targetType: 'site_setting',
      targetId: k,
      beforeState: k === 'about' ? undefined : before,
      afterState: k === 'about' ? { updated: true } : after,
    });
    // Footer/About copy and rule numbers are on many cached pages;
    // gamification/scoring also change listings and profiles.
    void this.webRevalidation.revalidate(k === 'about' || k === 'footer' ? ['site-settings'] : ['site-settings', 'restaurants']);
    return this.siteSettings.getAll();
  }
}
