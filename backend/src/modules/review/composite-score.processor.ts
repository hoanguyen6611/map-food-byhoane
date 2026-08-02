import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { COMPOSITE_SCORE_QUEUE } from './composite-score.service';
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
    await this.compositeScoreService.recompute(job.data.restaurantId);
  }

  // Runs within the same NestJS process (modular monolith — no separate
  // worker deployment needed at this scale, see docs/07-tech-stack.md §2).
  // A failed recompute just leaves the previous score stale until the next
  // successful job for the same restaurant; it never corrupts data, so we
  // only log, we don't need custom retry/backoff tuning beyond BullMQ's
  // defaults for this module's scope.
  onModuleInit(): void {
    this.logger.log('Composite score worker ready');
  }
}
