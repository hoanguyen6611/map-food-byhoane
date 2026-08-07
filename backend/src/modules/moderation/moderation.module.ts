import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ContributionModerationService } from './contribution-moderation.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

// Report handling (build-prompts/07) + contribution moderation (real Claude
// adapter via AiModule/ClaudeGatewayService), consumed by ContributionModule.
// The Admin Moderation Queue's list/decision endpoints live in AdminModule
// instead (mirrors how AdminRestaurantController lives in AdminModule while
// RestaurantModule holds the public-facing logic) — it imports this
// module for ReportService (report resolution + related-report lookup).
@Module({
  imports: [AiModule],
  controllers: [ReportController],
  providers: [ContributionModerationService, ReportService],
  exports: [ContributionModerationService, ReportService],
})
export class ModerationModule {}
