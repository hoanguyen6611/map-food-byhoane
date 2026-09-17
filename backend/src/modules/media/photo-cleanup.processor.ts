import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { MediaService } from './media.service';

export const PHOTO_CLEANUP_QUEUE = 'photo-cleanup';
const SWEEP_ORPHANS_JOB = 'sweep-orphans';
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly — orphans are only swept once >24h old anyway.

@Processor(PHOTO_CLEANUP_QUEUE)
@Injectable()
export class PhotoCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PhotoCleanupProcessor.name);

  constructor(
    private readonly mediaService: MediaService,
    @InjectQueue(PHOTO_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const swept = await this.mediaService.sweepOrphans();
    if (swept > 0) {
      this.logger.log(
        `Orphan photo sweep removed ${swept} unattached photo(s)`,
      );
    }
  }

  // Registers the repeatable job once per process start (BullMQ dedupes
  // identical repeat configs, so this is safe across restarts too) — same
  // "runs within this same NestJS process" rationale as CompositeScoreProcessor.
  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_ORPHANS_JOB,
      {},
      { repeat: { every: SWEEP_INTERVAL_MS } },
    );
    this.logger.log('Photo cleanup worker ready');
  }
}
