import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { CuisineCode, MeResponse } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { GamificationService } from './gamification.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { RequestUser } from '../auth/auth.types';

const isUniqueConstraintViolation = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly gamificationService: GamificationService,
  ) {}

  async getMe(currentUser: RequestUser): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { profile: true, role: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const gamification = await this.gamificationService.computeForUser(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role.code,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      profile: {
        displayName: user.profile.displayName,
        avatarPhotoId: user.profile.avatarPhotoId,
        avatarUrl: await this.resolveAvatarUrl(user.profile.avatarPhotoId),
        bio: user.profile.bio,
        homeCity: user.profile.homeCity,
        username: user.profile.username,
        isPublic: user.profile.isPublic,
        facebookUrl: user.profile.facebookUrl,
        instagramUrl: user.profile.instagramUrl,
        favoriteCuisines: user.profile.favoriteCuisines as CuisineCode[],
      },
      gamification,
    };
  }

  /** Raw id -> real URL, or null if unset/no longer resolvable (deleted photo, bad legacy data, etc). */
  private async resolveAvatarUrl(
    avatarPhotoId: string | null,
  ): Promise<string | null> {
    if (!avatarPhotoId) return null;
    const photo = await this.prisma.photo.findUnique({
      where: { id: avatarPhotoId },
    });
    if (!photo || photo.deletedAt) return null;
    return this.mediaService.resolveUrl(photo.storageKey);
  }

  async updateProfile(
    currentUser: RequestUser,
    dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    // `avatarPhotoId` is the first real caller of this field — validate it
    // properly rather than writing whatever id the client sends straight to
    // the DB (there was previously no existence/ownership/status check at
    // all here). `null` (clearing the avatar) skips validation entirely.
    if (dto.avatarPhotoId) {
      const photo = await this.prisma.photo.findUnique({
        where: { id: dto.avatarPhotoId },
      });
      const isValidAvatar =
        photo &&
        !photo.deletedAt &&
        photo.uploadedBy === currentUser.id &&
        photo.ownerType === 'user_profile' &&
        photo.ownerId === currentUser.id &&
        photo.status === 'approved';
      if (!isValidAvatar) {
        throw new BadRequestException('Ảnh đại diện không hợp lệ.');
      }
    }

    // Unknown cuisine codes are silently dropped, same convention as
    // contribution.service.ts's cuisineCodes handling — a stale/typo'd code
    // from an older client build shouldn't hard-fail the whole save.
    let favoriteCuisines: string[] | undefined;
    if (dto.favoriteCuisines !== undefined) {
      const known = await this.prisma.cuisine.findMany({
        where: { code: { in: dto.favoriteCuisines } },
        select: { code: true },
      });
      const knownCodes = new Set(known.map((c) => c.code));
      favoriteCuisines = dto.favoriteCuisines.filter((c) => knownCodes.has(c));
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.phone !== undefined) {
          await tx.user.update({
            where: { id: currentUser.id },
            data: { phone: dto.phone },
          });
        }
        const profileData: Record<string, unknown> = {};
        if (dto.displayName !== undefined)
          profileData.displayName = dto.displayName;
        if (dto.avatarPhotoId !== undefined)
          profileData.avatarPhotoId = dto.avatarPhotoId;
        if (dto.bio !== undefined) profileData.bio = dto.bio;
        if (dto.homeCity !== undefined) profileData.homeCity = dto.homeCity;
        if (dto.username !== undefined) profileData.username = dto.username;
        if (dto.isPublic !== undefined) profileData.isPublic = dto.isPublic;
        if (dto.facebookUrl !== undefined)
          profileData.facebookUrl = dto.facebookUrl;
        if (dto.instagramUrl !== undefined)
          profileData.instagramUrl = dto.instagramUrl;
        if (favoriteCuisines !== undefined)
          profileData.favoriteCuisines = favoriteCuisines;
        if (Object.keys(profileData).length > 0) {
          await tx.userProfile.update({
            where: { userId: currentUser.id },
            data: profileData,
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Tên người dùng này đã được sử dụng.');
      }
      throw error;
    }

    return this.getMe(currentUser);
  }

  /**
   * Separate from `updateProfile()` because web's avatar picker uploads via
   * ImageKit (a URL), unlike `avatarPhotoId` which expects an already-owned
   * Photo id from the S3/MediaModule flow mobile's AvatarPicker uses. Reuses
   * `MediaService.attachExternalUrls` (already ImageKit-origin-validated,
   * already auto-approves — see its doc comment) rather than reinventing
   * upload plumbing. The per-owner photo cap for `user_profile` is 1, so any
   * previous avatar is deleted first — otherwise a second upload would always
   * fail the cap check.
   */
  async updateAvatar(
    currentUser: RequestUser,
    photoUrl: string | null,
  ): Promise<MeResponse> {
    await this.prisma.$transaction(async (tx) => {
      await tx.photo.deleteMany({
        where: { ownerType: 'user_profile', ownerId: currentUser.id },
      });
      if (photoUrl) {
        await this.mediaService.attachExternalUrls(
          currentUser.id,
          'user_profile',
          currentUser.id,
          [photoUrl],
          tx,
        );
        const photo = await tx.photo.findFirst({
          where: { ownerType: 'user_profile', ownerId: currentUser.id },
          orderBy: { createdAt: 'desc' },
        });
        await tx.userProfile.update({
          where: { userId: currentUser.id },
          data: { avatarPhotoId: photo?.id ?? null },
        });
      } else {
        await tx.userProfile.update({
          where: { userId: currentUser.id },
          data: { avatarPhotoId: null },
        });
      }
    });

    return this.getMe(currentUser);
  }

  // Soft, anonymizing delete per docs/01-prd-mvp.md Business Rule 6 — never
  // a hard delete, so authored reviews/contributions retain moderation/audit
  // integrity. Email is replaced with a unique placeholder to free up the
  // real address (the unique constraint on User.email would otherwise block
  // ever re-registering with it).
  async deleteAccount(currentUser: RequestUser): Promise<void> {
    const anonymizedEmail = `deleted-${randomUUID()}@deleted.local`;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: currentUser.id },
        data: {
          email: anonymizedEmail,
          phone: null,
          passwordHash: null,
          oauthSubjectId: null,
          status: 'deleted',
        },
      }),
      this.prisma.userProfile.update({
        where: { userId: currentUser.id },
        data: {
          displayName: 'Người dùng đã xoá',
          avatarPhotoId: null,
          bio: null,
          homeCity: null,
          username: null,
          facebookUrl: null,
          instagramUrl: null,
          favoriteCuisines: [],
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: currentUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
