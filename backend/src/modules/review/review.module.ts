import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReviewController, RestaurantReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ReviewModerationService } from './review-moderation.service';
import { CompositeScoreService, COMPOSITE_SCORE_QUEUE } from './composite-score.service';
import { CompositeScoreProcessor } from './composite-score.processor';

// Implements docs/build-prompts/06-reviews-scoring.md — review CRUD,
// criteria ratings, composite-score recompute job.
@Module({
  imports: [BullModule.registerQueue({ name: COMPOSITE_SCORE_QUEUE })],
  controllers: [ReviewController, RestaurantReviewController],
  providers: [ReviewService, ReviewModerationService, CompositeScoreService, CompositeScoreProcessor],
  exports: [CompositeScoreService],
})
export class ReviewModule {}
