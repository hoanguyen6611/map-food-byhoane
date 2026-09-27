import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicProfileContributedRestaurantDto, PublicProfileDto, PublicProfileReviewListResponse } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { GamificationService } from './gamification.service';
import { ReviewService } from '../review/review.service';

const MAX_CONTRIBUTED_RESTAURANTS = 12;

// Public counterpart to UserService — reads ANY user's profile (gated by
// UserProfile.isPublic, see getProfile's doc comment), never writes.
// Deliberately does NOT depend on FollowModule: it only ever READS Follow
// rows (counts, "does the viewer follow this profile"), which is a trivial
// enough query to do directly rather than importing a whole module for it —
// FollowModule owns the write side (follow/unfollow + notification).
@Injectable()
export class UserPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly gamificationService: GamificationService,
    private readonly reviewService: ReviewService,
  ) {}

  /**
   * `viewerId` is the optional-auth caller's own id (undefined for a
   * logged-out visitor). A profile with `isPublic: false` 404s for anyone
   * else — but never for the profile's own owner previewing their public
   * view. "Private" and "doesn't exist" are treated identically so a
   * private profile's existence isn't leaked by a different error shape.
   */
  async getProfile(targetId: string, viewerId?: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { profile: true },
    });
    const isSelf = viewerId === targetId;
    if (!user || !user.profile || user.status !== 'active' || (!user.profile.isPublic && !isSelf)) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const [gamification, reviewCount, followerCount, followingCount, followEdge, contributedRestaurants] =
      await Promise.all([
        this.gamificationService.computeForUser(targetId),
        this.prisma.review.count({ where: { userId: targetId, status: 'published', deletedAt: null } }),
        this.prisma.follow.count({ where: { followingId: targetId } }),
        this.prisma.follow.count({ where: { followerId: targetId } }),
        viewerId
          ? this.prisma.follow.findUnique({
              where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
            })
          : null,
        this.fetchContributedRestaurants(targetId),
      ]);

    return {
      id: user.id,
      displayName: user.profile.displayName,
      username: user.profile.username,
      avatarUrl: await this.resolveAvatarUrl(user.profile.avatarPhotoId),
      bio: user.profile.bio,
      homeCity: user.profile.homeCity,
      createdAt: user.createdAt.toISOString(),
      gamification,
      reviewCount,
      followerCount,
      followingCount,
      isFollowedByViewer: followEdge !== null,
      contributedRestaurants,
    };
  }

  async listReviews(targetId: string, viewerId: string | undefined, page: number, pageSize: number): Promise<PublicProfileReviewListResponse> {
    // Same visibility gate as getProfile — a private profile's reviews
    // aren't a separate hole to check.
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { status: true, profile: { select: { isPublic: true } } },
    });
    const isSelf = viewerId === targetId;
    if (!user || !user.profile || user.status !== 'active' || (!user.profile.isPublic && !isSelf)) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return this.reviewService.listPublishedForUser(targetId, page, pageSize);
  }

  /** Same as UserService's own — duplicated rather than cross-service-coupled (small helper, this codebase's established convention). */
  private async resolveAvatarUrl(avatarPhotoId: string | null): Promise<string | null> {
    if (!avatarPhotoId) return null;
    const photo = await this.prisma.photo.findUnique({ where: { id: avatarPhotoId } });
    if (!photo || photo.deletedAt) return null;
    return this.mediaService.resolveUrl(photo.storageKey);
  }

  private async fetchContributedRestaurants(userId: string): Promise<PublicProfileContributedRestaurantDto[]> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { submittedBy: userId, deletedAt: null, status: { publicationStatus: 'published' } },
      include: { category: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTRIBUTED_RESTAURANTS,
    });
    const restaurantIds = restaurants.map((r) => r.id);
    const photos = restaurantIds.length
      ? await this.prisma.photo.findMany({
          where: { ownerType: 'restaurant', ownerId: { in: restaurantIds }, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const thumbnailByRestaurantId = new Map<string, string>();
    for (const photo of photos) {
      if (photo.ownerId && !thumbnailByRestaurantId.has(photo.ownerId)) {
        thumbnailByRestaurantId.set(photo.ownerId, this.mediaService.resolveUrl(photo.storageKey));
      }
    }
    return restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      thumbnailUrl: thumbnailByRestaurantId.get(r.id) ?? null,
      categoryLabel: r.category.label,
      compositeScore: r.status?.compositeScore ? Number(r.status.compositeScore) : null,
    }));
  }
}
