import { Injectable } from '@nestjs/common';
import type { AdminDashboardStatsDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const ACTIVITY_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD`, UTC — matches `createdAt.toISOString().slice(0, 10)` below, so bucketing is consistent regardless of server timezone. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminDashboardStatsDto> {
    const since = new Date(Date.now() - ACTIVITY_DAYS * MS_PER_DAY);

    const [
      pendingRestaurants,
      pendingReviews,
      newReports,
      activeUsers,
      recentReviews,
      recentContributions,
      recentUsers,
      ratingGroups,
    ] = await Promise.all([
      this.prisma.moderationResult.count({ where: { targetType: 'restaurant', decision: 'pending' } }),
      this.prisma.moderationResult.count({ where: { targetType: 'review', decision: 'pending' } }),
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.review.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.contribution.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      // A plain small-cardinality Int column (1-5) — exactly what `groupBy` is
      // for, unlike the day-bucketing above (which needs Postgres `date_trunc`,
      // not expressible via Prisma's groupBy, hence the in-memory bucketing).
      this.prisma.review.groupBy({ by: ['overallRating'], where: { status: 'published' }, _count: true }),
    ]);

    const reviewsByDay = this.bucketByDay(recentReviews);
    const contributionsByDay = this.bucketByDay(recentContributions);
    const usersByDay = this.bucketByDay(recentUsers);

    const activity = Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
      const date = dayKey(new Date(since.getTime() + index * MS_PER_DAY));
      return {
        date,
        newReviews: reviewsByDay.get(date) ?? 0,
        newContributions: contributionsByDay.get(date) ?? 0,
        newUsers: usersByDay.get(date) ?? 0,
      };
    });

    const countByRating = new Map(ratingGroups.map((group) => [group.overallRating, group._count]));
    const ratingDistribution = ([1, 2, 3, 4, 5] as const).map((rating) => ({
      rating,
      count: countByRating.get(rating) ?? 0,
    }));

    return {
      kpis: { pendingRestaurants, pendingReviews, newReports, activeUsers },
      activity,
      ratingDistribution,
    };
  }

  private bucketByDay(rows: { createdAt: Date }[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = dayKey(row.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }
}
