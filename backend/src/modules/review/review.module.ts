import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaModule } from '../media/media.module';
import { AiModule } from '../ai/ai.module';
import { ReviewController, RestaurantReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ReviewModerationService } from './review-moderation.service';
import { CompositeScoreService, COMPOSITE_SCORE_QUEUE } from './composite-score.service';
import { CompositeScoreProcessor } from './composite-score.processor';

// Implements docs/build-prompts/06-reviews-scoring.md — review CRUD,
// criteria ratings, composite-score recompute job. MediaModule (build-prompts/07)
// is imported for MediaService.reparent — a review's photoIds are
// reparented onto it after creation/update, same pattern as ContributionModule.
// AiModule is imported for ClaudeGatewayService (ReviewModerationService)
// and AiSummaryService (CompositeScoreService's regenerate-on-recompute hook).
@Module({
  imports: [BullModule.registerQueue({ name: COMPOSITE_SCORE_QUEUE }), MediaModule, AiModule],
  controllers: [ReviewController, RestaurantReviewController],
  providers: [ReviewService, ReviewModerationService, CompositeScoreService, CompositeScoreProcessor],
  exports: [CompositeScoreService],
})
export class ReviewModule {}
