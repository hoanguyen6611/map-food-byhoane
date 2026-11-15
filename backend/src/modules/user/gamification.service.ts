import { Injectable } from '@nestjs/common';
import type { BadgeCode, GamificationDto, LeaderboardEntryDto } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import type { GamificationSettings } from '@foodmap/shared-types';

// Points per activity, level thresholds and badge thresholds are
// admin-editable (site settings → gamification, defaults in
// packages/shared-types/src/site-settings.ts). computeForUser and
// getLeaderboard read the same settings object per call, so a user's own
// profile and the leaderboard can never disagree.

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
interface LeaderboardRawRow {
  user_id: string;
  display_name: string;
  storage_key: string | null;
  points: number;
}

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly siteSettings: SiteSettingsService,
  ) {}

  async computeForUser(userId: string): Promise<GamificationDto> {
    const [counts, rules] = await Promise.all([this.fetchActivityCounts(userId), this.siteSettings.get('gamification')]);
    const points =
      counts.publishedReviewCount * rules.pointsPerReview +
      counts.approvedContributionCount * rules.pointsPerContribution +
      counts.helpfulVotesReceived * rules.pointsPerHelpfulVote;

    const { level, pointsToNextLevel, nextLevelThreshold } = this.computeLevel(points, rules);
    const badges = this.computeBadges(counts, rules);

    return {
      points,
      level,
      pointsToNextLevel,
      nextLevelThreshold,
      helpfulVotesReceived: counts.helpfulVotesReceived,
      badges,
    };
  }

  /**
   * Public contributor leaderboard — unlike computeForUser (one user at a
   * time), this aggregates ALL users' points in a single raw SQL query
   * (three GROUP BY subqueries, one per scoring input, left-joined onto
   * users) rather than looping computeForUser per row, which would be one
   * query per user and doesn't scale. Weights are the same exported
   * constants computeForUser uses, so ranking here always matches what a
   * user's own profile page reports. Excludes UserProfile.isPublic === false
   * users, same visibility rule PublicProfileDto's own gate uses.
   */
  async getLeaderboard(limit: number): Promise<LeaderboardEntryDto[]> {
    const rules = await this.siteSettings.get('gamification');
    const rows = await this.prisma.$queryRaw<LeaderboardRawRow[]>`
      SELECT
        u.id AS user_id,
        up.display_name,
        p.storage_key,
        (
          COALESCE(rev.count, 0) * ${rules.pointsPerReview}
          + COALESCE(con.count, 0) * ${rules.pointsPerContribution}
          + COALESCE(hv.count, 0) * ${rules.pointsPerHelpfulVote}
        )::int AS points
      FROM users u
      JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN photos p ON p.id = up.avatar_photo_id AND p.deleted_at IS NULL
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count FROM reviews
        WHERE status = 'published' AND deleted_at IS NULL
        GROUP BY user_id
      ) rev ON rev.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count FROM contributions
        WHERE type = 'new_restaurant' AND status IN ('approved', 'auto_approved')
        GROUP BY user_id
      ) con ON con.user_id = u.id
      LEFT JOIN (
        SELECT r.user_id, COUNT(*) AS count FROM review_helpful_votes rhv
        JOIN reviews r ON r.id = rhv.review_id
        GROUP BY r.user_id
      ) hv ON hv.user_id = u.id
      WHERE u.status = 'active' AND up.is_public = true
      ORDER BY points DESC
      LIMIT ${limit}
    `;

    return rows.map((row, i) => ({
      rank: i + 1,
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.storage_key ? this.mediaService.resolveUrl(row.storage_key) : null,
      points: row.points,
      level: this.computeLevel(row.points, rules).level,
    }));
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

  private computeLevel(points: number, rules: GamificationSettings): {
    level: number;
    pointsToNextLevel: number | null;
    nextLevelThreshold: number | null;
  } {
    const thresholds = rules.levelThresholds;
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) {
      if (points >= thresholds[i]) level = i + 1;
    }
    const nextLevelThreshold =
      level < thresholds.length ? thresholds[level] : null;
    return {
      level,
      nextLevelThreshold,
      pointsToNextLevel: nextLevelThreshold === null ? null : nextLevelThreshold - points,
    };
  }

  private computeBadges(counts: ActivityCounts, rules: GamificationSettings): BadgeCode[] {
    const badges: BadgeCode[] = [];
    if (counts.approvedContributionCount >= rules.badgeThresholds.contributor_10) {
      badges.push('contributor_10');
    }
    if (counts.coffeeReviewCount >= rules.badgeThresholds.coffee_hunter) {
      badges.push('coffee_hunter');
    }
    if (counts.helpfulVotesReceived >= rules.badgeThresholds.helpful_100) {
      badges.push('helpful_100');
    }
    return badges;
  }
}
