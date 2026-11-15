import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SiteSettingsDto } from '@foodmap/shared-types';
import { SiteSettingsService } from './site-settings.service';

/** Public: everything here is shown on the website anyway (footer, About page, scoring rules). */
@ApiTags('Site settings')
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettings: SiteSettingsService) {}

  @Get()
  get(): Promise<SiteSettingsDto> {
    return this.siteSettings.getAll();
  }
}
