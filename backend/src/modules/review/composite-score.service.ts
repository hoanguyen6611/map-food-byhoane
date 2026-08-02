import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateCompositeScore } from './composite-score.util';

export const COMPOSITE_SCORE_QUEUE = 'composite-score';
export const COMPOSITE_SCORE_JOB = 'recompute';

// Only used if literally zero published reviews exist anywhere yet (cold
// start) — a neutral prior so the very first review in the system doesn't
// divide by an undefined global mean.
const DEFAULT_GLOBAL_PRIOR = 3.5;

@Injectable()
export class CompositeScoreService {
  private readonly logger = new Logger(CompositeScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(COMPOSITE_SCORE_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueRecompute(restaurantId: string): Promise<void> {
    await this.queue.add(COMPOSITE_SCORE_JOB, { restaurantId });
  }

  // Formula itself lives in composite-score.util.ts (a pure function, unit
  // tested against the exact PRD §10.8 acceptance case) — this method's job
  // is just gathering v/R/C from the DB and persisting the result.
  async recompute(restaurantId: string): Promise<void> {
    const [restaurantAgg, globalAgg, lastReview] = await Promise.all([
      this.prisma.review.aggregate({
        where: { restaurantId, status: 'published', deletedAt: null },
        _avg: { overallRating: true },
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { status: 'published', deletedAt: null },
        _avg: { overallRating: true },
      }),
      this.prisma.review.findFirst({
        where: { restaurantId, status: 'published', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const v = restaurantAgg._count._all;
    const R = restaurantAgg._avg.overallRating ?? 0;
    const C = globalAgg._avg.overallRating ?? DEFAULT_GLOBAL_PRIOR;
    const compositeScore = calculateCompositeScore(v, R, C);

    await this.prisma.restaurantStatus.update({
      where: { restaurantId },
      data: {
        compositeScore: compositeScore === null ? null : new Prisma.Decimal(compositeScore.toFixed(2)),
        reviewCount: v,
        lastReviewAt: lastReview?.createdAt ?? null,
        lastComputedAt: new Date(),
      },
    });

    this.logger.debug(`Recomputed composite score for ${restaurantId}: v=${v} R=${R.toFixed(2)} C=${C.toFixed(2)} -> ${compositeScore?.toFixed(2) ?? 'null'}`);
  }
}
