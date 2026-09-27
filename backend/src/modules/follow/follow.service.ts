import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { FollowActionResponse } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

// Backs web's /profile/[id] "Theo dõi" button. Both actions are idempotent
// (same convention as FavoriteService.add/remove) — following someone
// you already follow, or unfollowing someone you don't, just succeeds and
// reflects the already-true end state, never an error.
@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<FollowActionResponse> {
    if (followerId === followingId) {
      throw new BadRequestException('Không thể tự theo dõi chính mình.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { status: true },
    });
    if (!target || target.status !== 'active') {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });

    // Best-effort, same "never block the core flow" shape as every other
    // notification producer in this codebase (e.g. ReviewService's
    // notifyHelpfulVote) — a failure here must never fail the follow
    // itself, which has already been persisted.
    this.notifyNewFollower(followerId, followingId).catch((error) =>
      this.logger.error('Failed to send new-follower notification', error instanceof Error ? error.stack : error),
    );

    return this.getActionResponse(followerId, followingId);
  }

  async unfollow(followerId: string, followingId: string): Promise<FollowActionResponse> {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId } });
    return this.getActionResponse(followerId, followingId);
  }

  private async getActionResponse(followerId: string, followingId: string): Promise<FollowActionResponse> {
    const [followerCount, edge] = await Promise.all([
      this.prisma.follow.count({ where: { followingId } }),
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      }),
    ]);
    return { followerCount, isFollowedByViewer: edge !== null };
  }

  private async notifyNewFollower(followerId: string, followingId: string): Promise<void> {
    const followerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: followerId },
      select: { displayName: true },
    });
    const followerName = followerProfile?.displayName ?? 'Một người dùng';
    await this.notificationService.create(followingId, 'new_follower', {
      title: `${followerName} đã bắt đầu theo dõi bạn`,
      body: 'Xem hồ sơ của họ và theo dõi lại nhé.',
      deepLink: { screen: 'Profile', userId: followerId },
    });
  }
}
