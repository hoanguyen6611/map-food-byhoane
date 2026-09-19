import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSummaryService } from '../ai/ai-summary.service';
import { calculateCompositeScore } from './composite-score.util';

export const COMPOSITE_SCORE_QUEUE = 'composite-score';
export const COMPOSITE_SCORE_JOB = 'recompute';
// Safety net alongside the per-review event-driven recompute above — a job
// can still be missed (Redis restart mid-flight, a bug that predates the
// retry/backoff hardening, etc.), silently sticking a restaurant's
// reviewCount/compositeScore stale forever with nothing to ever re-trigger
// it. This job re-recomputes every restaurant on a schedule, so a stale
// value is self-healing within one cycle instead of permanent.
export const RECONCILE_ALL_JOB = 'reconcile-all';
const RECONCILE_REPEAT_KEY = 'composite-score-reconcile';
// Every 6 hours — frequent enough that "stale forever" becomes "stale for
// at most a few hours", infrequent enough not to matter at this data scale
// (a handful of cheap aggregate queries per restaurant).
const RECONCILE_CRON = '0 */6 * * *';

// Only used if literally zero published reviews exist anywhere yet (cold
// start) — a neutral prior so the very first review in the system doesn't
// divide by an undefined global mean.
const DEFAULT_GLOBAL_PRIOR = 3.5;

@Injectable()
export class CompositeScoreService implements OnModuleInit {
  private readonly logger = new Logger(CompositeScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(COMPOSITE_SCORE_QUEUE) private readonly queue: Queue,
    private readonly aiSummaryService: AiSummaryService,
  ) {}

  // Registering the same repeat pattern on every boot is safe — BullMQ
  // dedupes repeatable jobs by name+pattern, it doesn't pile up duplicates.
  // The immediate one-off `enqueueReconcileAll()` alongside it means a
  // restaurant already stuck stale (e.g. from before the retry/backoff
  // hardening existed) heals on the very next deploy, not up to 6h later.
  async onModuleInit(): Promise<void> {
    await this.queue.add(
      RECONCILE_ALL_JOB,
      {},
      { repeat: { pattern: RECONCILE_CRON }, jobId: RECONCILE_REPEAT_KEY },
    );
    await this.enqueueReconcileAll();
  }

  async enqueueRecompute(restaurantId: string): Promise<void> {
    await this.queue.add(COMPOSITE_SCORE_JOB, { restaurantId });
  }

  async enqueueReconcileAll(): Promise<void> {
    await this.queue.add(RECONCILE_ALL_JOB, {});
  }

  /** Recomputes every non-deleted restaurant — see RECONCILE_ALL_JOB's doc comment above. */
  async reconcileAll(): Promise<void> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const { id } of restaurants) {
      try {
        await this.recompute(id);
      } catch (error) {
        // One restaurant's bad data must never abort the whole sweep —
        // log and move on, same as any other per-item loop in this codebase.
        this.logger.error(
          `Reconcile-all: recompute failed for restaurant ${id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
    this.logger.log(`Reconcile-all: recomputed ${restaurants.length} restaurants`);
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
        compositeScore:
          compositeScore === null
            ? null
            : new Prisma.Decimal(compositeScore.toFixed(2)),
        reviewCount: v,
        lastReviewAt: lastReview?.createdAt ?? null,
        lastComputedAt: new Date(),
      },
    });

    this.logger.debug(
      `Recomputed composite score for ${restaurantId}: v=${v} R=${R.toFixed(2)} C=${C.toFixed(2)} -> ${compositeScore?.toFixed(2) ?? 'null'}`,
    );

    // Fail-safe internally (AiSummaryService.regenerateIfNeeded never
    // throws) — a Claude/AI Summary issue must never break composite-score
    // recomputation itself.
    await this.aiSummaryService.regenerateIfNeeded(restaurantId);
  }
}
