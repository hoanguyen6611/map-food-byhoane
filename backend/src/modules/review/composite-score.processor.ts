import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  COMPOSITE_SCORE_JOB,
  COMPOSITE_SCORE_QUEUE,
  RECONCILE_ALL_JOB,
} from './composite-score.service';
import { CompositeScoreService } from './composite-score.service';

interface RecomputeJobData {
  restaurantId: string;
}

@Processor(COMPOSITE_SCORE_QUEUE)
export class CompositeScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(CompositeScoreProcessor.name);

  constructor(private readonly compositeScoreService: CompositeScoreService) {
    super();
  }

  async process(job: Job<RecomputeJobData>): Promise<void> {
    if (job.name === RECONCILE_ALL_JOB) {
      await this.compositeScoreService.reconcileAll();
      return;
    }
    if (job.name === COMPOSITE_SCORE_JOB) {
      await this.compositeScoreService.recompute(job.data.restaurantId);
      return;
    }
    this.logger.warn(`Unknown job name on ${COMPOSITE_SCORE_QUEUE} queue: ${job.name}`);
  }

  // Runs within the same NestJS process (modular monolith — no separate
  // worker deployment needed at this scale, see docs/07-tech-stack.md §2).
  // A failed recompute just leaves the previous score stale until the next
  // successful job for the same restaurant; it never corrupts data, so we
  // only log — see `defaultJobOptions` on the queue registration
  // (review.module.ts) for the retry/backoff tuning, and `onFailed` below
  // for the log line a stuck stale count needs to actually be visible.
  onModuleInit(): void {
    this.logger.log('Composite score worker ready');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RecomputeJobData> | undefined, error: Error): void {
    this.logger.error(
      `Composite score recompute failed for restaurant ${job?.data.restaurantId ?? 'unknown'} (attempt ${job?.attemptsMade}): ${error.message}`,
      error.stack,
    );
  }
}
