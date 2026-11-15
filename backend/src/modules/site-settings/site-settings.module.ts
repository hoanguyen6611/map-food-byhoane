import { Global, Module } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller';
import { SiteSettingsService } from './site-settings.service';

// Global: scoring (ReviewModule) and gamification (UserModule) read these
// rules, AdminModule writes them — one cached service instance for all.
@Global()
@Module({
  controllers: [SiteSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
