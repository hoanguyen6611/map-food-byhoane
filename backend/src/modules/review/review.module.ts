import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaModule } from '../media/media.module';
import { AiModule } from '../ai/ai.module';
import { NotificationModule } from '../notification/notification.module';
import {
  ReviewController,
  RestaurantReviewController,
  MyReviewController,
} from './review.controller';
import { ReviewService } from './review.service';
import { ReviewModerationService } from './review-moderation.service';
import {
  CompositeScoreService,
  COMPOSITE_SCORE_QUEUE,
} from './composite-score.service';
import { CompositeScoreProcessor } from './composite-score.processor';

// Implements docs/build-prompts/06-reviews-scoring.md — review CRUD,
// criteria ratings, composite-score recompute job. MediaModule (build-prompts/07)
// is imported for MediaService.reparent — a review's photoIds are
// reparented onto it after creation/update, same pattern as ContributionModule.
// AiModule is imported for ClaudeGatewayService (ReviewModerationService)
// and AiSummaryService (CompositeScoreService's regenerate-on-recompute hook).
@Module({
  imports: [
    BullModule.registerQueue({
      name: COMPOSITE_SCORE_QUEUE,
      // A recompute failure (transient DB hiccup, etc.) must not permanently
      // stick a stale reviewCount/compositeScore — retry with backoff before
      // giving up; see CompositeScoreProcessor's onFailed for the log line
      // that fires if all attempts are exhausted.
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
    MediaModule,
    AiModule,
    NotificationModule,
  ],
  controllers: [
    ReviewController,
    RestaurantReviewController,
    MyReviewController,
  ],
  providers: [
    ReviewService,
    ReviewModerationService,
    CompositeScoreService,
    CompositeScoreProcessor,
  ],
  exports: [CompositeScoreService],
})
export class ReviewModule {}
