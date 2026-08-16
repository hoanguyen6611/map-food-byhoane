import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MeResponse } from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { RequestUser } from '../auth/auth.types';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async getMe(currentUser: RequestUser): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { profile: true, role: true },
    });
    if (!user || !user.profile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role.code,
        status: user.status,
      },
      profile: {
        displayName: user.profile.displayName,
        avatarPhotoId: user.profile.avatarPhotoId,
        avatarUrl: await this.resolveAvatarUrl(user.profile.avatarPhotoId),
        bio: user.profile.bio,
        homeCity: user.profile.homeCity,
      },
    };
  }

  /** Raw id -> real URL, or null if unset/no longer resolvable (deleted photo, bad legacy data, etc). */
  private async resolveAvatarUrl(avatarPhotoId: string | null): Promise<string | null> {
    if (!avatarPhotoId) return null;
    const photo = await this.prisma.photo.findUnique({ where: { id: avatarPhotoId } });
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
      const photo = await this.prisma.photo.findUnique({ where: { id: dto.avatarPhotoId } });
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
      if (Object.keys(profileData).length > 0) {
        await tx.userProfile.update({
          where: { userId: currentUser.id },
          data: profileData,
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
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: currentUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
