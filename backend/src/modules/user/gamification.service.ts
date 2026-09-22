import { Injectable } from '@nestjs/common';
import type { BadgeCode, GamificationDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const POINTS_PER_REVIEW = 10;
const POINTS_PER_CONTRIBUTION = 15;
const POINTS_PER_HELPFUL_VOTE = 2;

// Level `i+1` starts at LEVEL_THRESHOLDS[i] points. 5 levels; level 5 has no
// ceiling (pointsToNextLevel/nextLevelThreshold are null once reached).
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000];

const COFFEE_HUNTER_REVIEW_THRESHOLD = 10;
const CONTRIBUTOR_BADGE_THRESHOLD = 10;
const HELPFUL_BADGE_THRESHOLD = 100;

const COFFEE_CATEGORY_CODE = 'quan_ca_phe';

interface ActivityCounts {
  publishedReviewCount: number;
  approvedContributionCount: number;
  helpfulVotesReceived: number;
  coffeeReviewCount: number;
}

/**
 * Every number here is computed live from real rows on every call — no
 * points/level/badge table anywhere. That's a deliberate choice: the inputs
 * are cheap, already-indexed COUNT queries (a user's own profile page is not
 * a hot path), and a live computation can never drift out of sync the way a
 * running counter updated from N different call sites inevitably would.
 */
@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForUser(userId: string): Promise<GamificationDto> {
    const counts = await this.fetchActivityCounts(userId);
    const points =
      counts.publishedReviewCount * POINTS_PER_REVIEW +
      counts.approvedContributionCount * POINTS_PER_CONTRIBUTION +
      counts.helpfulVotesReceived * POINTS_PER_HELPFUL_VOTE;

    const { level, pointsToNextLevel, nextLevelThreshold } = this.computeLevel(points);
    const badges = this.computeBadges(counts);

    return {
      points,
      level,
      pointsToNextLevel,
      nextLevelThreshold,
      helpfulVotesReceived: counts.helpfulVotesReceived,
      badges,
    };
  }

  private async fetchActivityCounts(userId: string): Promise<ActivityCounts> {
    const coffeeCategory = await this.prisma.restaurantCategory.findUnique({
      where: { code: COFFEE_CATEGORY_CODE },
      select: { id: true },
    });

    const [publishedReviewCount, approvedContributionCount, helpfulVotesReceived, coffeeReviewCount] =
      await Promise.all([
        this.prisma.review.count({
          where: { userId, status: 'published', deletedAt: null },
        }),
        this.prisma.contribution.count({
          where: {
            userId,
            type: 'new_restaurant',
            status: { in: ['approved', 'auto_approved'] },
          },
        }),
        this.prisma.reviewHelpfulVote.count({
          where: { review: { userId } },
        }),
        coffeeCategory
          ? this.prisma.review.count({
              where: {
                userId,
                status: 'published',
                deletedAt: null,
                restaurant: { categoryId: coffeeCategory.id },
              },
            })
          : Promise.resolve(0),
      ]);

    return {
      publishedReviewCount,
      approvedContributionCount,
      helpfulVotesReceived,
      coffeeReviewCount,
    };
  }

  private computeLevel(points: number): {
    level: number;
    pointsToNextLevel: number | null;
    nextLevelThreshold: number | null;
  } {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
    }
    const nextLevelThreshold =
      level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
    return {
      level,
      nextLevelThreshold,
      pointsToNextLevel: nextLevelThreshold === null ? null : nextLevelThreshold - points,
    };
  }

  private computeBadges(counts: ActivityCounts): BadgeCode[] {
    const badges: BadgeCode[] = [];
    if (counts.approvedContributionCount >= CONTRIBUTOR_BADGE_THRESHOLD) {
      badges.push('contributor_10');
    }
    if (counts.coffeeReviewCount >= COFFEE_HUNTER_REVIEW_THRESHOLD) {
      badges.push('coffee_hunter');
    }
    if (counts.helpfulVotesReceived >= HELPFUL_BADGE_THRESHOLD) {
      badges.push('helpful_100');
    }
    return badges;
  }
}
