import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeGatewayService } from './claude-gateway.service';

const DEFAULT_MODEL_VERSION = 'claude-opus-5-v1';

/**
 * Real trigger for AIGateway.summarize() (US-J1/J2) — replaces the former
 * no-op stub (ai-summary-trigger.stub.ts). Called from
 * CompositeScoreService.recompute(), which already runs on every new
 * published review via BullMQ (off the request path — a Claude call here
 * has no user-facing latency cost). Regenerates a restaurant's AISummary
 * whenever its review count first crosses AI_SUMMARY_MIN_REVIEW_COUNT, or
 * every AI_SUMMARY_REFRESH_INTERVAL_DAYS thereafter — never on every single
 * review, which would be wasteful for a rarely-changing summary.
 *
 * Always fail-safe: any error here is logged and swallowed, never
 * propagated — this is a best-effort background enhancement and must never
 * break whatever triggered it (review creation, composite-score recompute).
 */
@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly claudeGateway: ClaudeGatewayService,
  ) {}

  async regenerateIfNeeded(restaurantId: string): Promise<void> {
    try {
      const minReviewCount = Number(
        this.config.get<string>('AI_SUMMARY_MIN_REVIEW_COUNT', '5'),
      );
      const refreshIntervalDays = Number(
        this.config.get<string>('AI_SUMMARY_REFRESH_INTERVAL_DAYS', '7'),
      );

      const [status, existing, commentedReviewCount] = await Promise.all([
        this.prisma.restaurantStatus.findUnique({ where: { restaurantId } }),
        this.prisma.aISummary.findUnique({ where: { restaurantId } }),
        this.prisma.review.count({
          where: {
            restaurantId,
            status: 'published',
            deletedAt: null,
            comment: { not: null },
          },
        }),
      ]);

      const reviewCount = status?.reviewCount ?? 0;
      if (reviewCount < minReviewCount) {
        return;
      }
      if (commentedReviewCount === 0) {
        // Never fabricate a summary from star ratings alone.
        return;
      }
      if (existing) {
        const ageMs = Date.now() - existing.generatedAt.getTime();
        const refreshMs = refreshIntervalDays * 24 * 60 * 60 * 1000;
        if (ageMs < refreshMs) {
          return;
        }
      }

      const result = await this.claudeGateway.summarize(restaurantId);
      await this.prisma.aISummary.upsert({
        where: { restaurantId },
        create: {
          restaurantId,
          summaryText: result.summaryText,
          pros: result.pros,
          cons: result.cons,
          sourceReviewCount: reviewCount,
          modelVersion: DEFAULT_MODEL_VERSION,
          generatedAt: new Date(),
        },
        update: {
          summaryText: result.summaryText,
          pros: result.pros,
          cons: result.cons,
          sourceReviewCount: reviewCount,
          modelVersion: DEFAULT_MODEL_VERSION,
          generatedAt: new Date(),
        },
      });
      this.logger.log(
        `Regenerated AI summary for restaurant ${restaurantId} (${reviewCount} reviews).`,
      );
    } catch (error) {
      this.logger.error(
        `AI summary regeneration failed for restaurant ${restaurantId}, skipping this cycle: ${String(error)}`,
      );
    }
  }
}
