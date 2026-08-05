import { Module } from '@nestjs/common';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { MediaModule } from '../media/media.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ContributionController } from './contribution.controller';
import { ContributionService } from './contribution.service';
import { ContributionFinalizeService } from './contribution-finalize.service';

// Community Add Restaurant, edit suggestions, status reports
// (build-prompts/07-contribution-media-moderation-ai.md). ContributionFinalizeService
// is exported — the Admin Moderation Queue's decision endpoint (Phase 5,
// AdminModerationService) reuses it so "what does approving X actually do"
// lives in exactly one place.
@Module({
  imports: [RestaurantModule, MediaModule, ModerationModule],
  controllers: [ContributionController],
  providers: [ContributionService, ContributionFinalizeService],
  exports: [ContributionFinalizeService],
})
export class ContributionModule {}
