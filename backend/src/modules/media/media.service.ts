import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  MediaOwnerType,
  PhotoDto,
  UploadableImageContentType,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { PhotoModerationService } from './photo-moderation.service';
import { reencode, sniffImageMagicBytes } from './image-processing.util';

const ALLOWED_CONTENT_TYPES: UploadableImageContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB, per build-prompts/07's cap.
const UPLOAD_URL_EXPIRES_SECONDS = 300;
const ORPHAN_MAX_AGE_HOURS = 24;

// Per-owner photo caps, per build-prompts/07: "max 6 photos per review, 10
// per restaurant submission." Contributions don't have their own cap here —
// a contribution's photos are reparented onto the restaurant they create,
// so the restaurant cap applies transitively.
const OWNER_PHOTO_CAPS: Record<MediaOwnerType, number> = {
  review: 6,
  restaurant: 10,
  contribution: 10,
  user_profile: 1,
};

export interface CreateUploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface ConfirmUploadInput {
  storageKey: string;
  ownerType: MediaOwnerType;
  ownerId?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly photoModeration: PhotoModerationService,
  ) {}

  async createUploadUrl(
    userId: string,
    contentType: string,
    fileSizeBytes: number,
  ): Promise<CreateUploadUrlResult> {
    if (
      !ALLOWED_CONTENT_TYPES.includes(contentType as UploadableImageContentType)
    ) {
      throw new BadRequestException(
        'Định dạng ảnh không được hỗ trợ (chỉ JPEG/PNG/WEBP).',
      );
    }
    if (fileSizeBytes <= 0 || fileSizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Kích thước ảnh phải nhỏ hơn 8MB.');
    }

    const storageKey = `uploads/${userId}/${randomUUID()}`;
    const uploadUrl = await this.s3.presignPut(
      storageKey,
      contentType,
      UPLOAD_URL_EXPIRES_SECONDS,
    );
    const expiresAt = new Date(
      Date.now() + UPLOAD_URL_EXPIRES_SECONDS * 1000,
    ).toISOString();

    return { uploadUrl, storageKey, expiresAt };
  }

  async confirm(userId: string, input: ConfirmUploadInput): Promise<PhotoDto> {
    const head = await this.s3.headObject(input.storageKey);
    if (!head) {
      throw new BadRequestException('Upload không tồn tại hoặc đã hết hạn.');
    }
    if (head.contentLength > MAX_UPLOAD_BYTES) {
      await this.s3.deleteObject(input.storageKey).catch(() => undefined);
      throw new BadRequestException('Kích thước ảnh phải nhỏ hơn 8MB.');
    }

    const rawBuffer = await this.s3.getObjectBuffer(input.storageKey);
    const sniffedType = sniffImageMagicBytes(rawBuffer);
    if (!sniffedType) {
      await this.s3.deleteObject(input.storageKey).catch(() => undefined);
      throw new BadRequestException('Định dạng file không hợp lệ.');
    }

    let processed;
    try {
      processed = await reencode(rawBuffer);
    } catch {
      await this.s3.deleteObject(input.storageKey).catch(() => undefined);
      throw new BadRequestException('File ảnh bị hỏng hoặc không thể xử lý.');
    }

    // Cap enforcement only makes sense once an owner exists to count
    // against — the new-restaurant/new-review flows have no ownerId yet at
    // confirm-time, so their caps are enforced later at reparent() time.
    if (input.ownerId) {
      await this.assertUnderCap(input.ownerType, input.ownerId, 1);
    }

    const photoId = randomUUID();
    const displayKey = `photos/${photoId}/display.jpg`;
    const thumbnailKey = `photos/${photoId}/thumb.jpg`;

    // Server-chosen content-type, always — never the client's declared
    // type. Nothing user-supplied is ever written to a permanent key.
    await this.s3.putObject(displayKey, processed.display, 'image/jpeg');
    await this.s3.putObject(thumbnailKey, processed.thumbnail, 'image/jpeg');
    await this.s3.deleteObject(input.storageKey).catch((error) => {
      this.logger.warn(
        `Failed to delete staging object ${input.storageKey}: ${String(error)}`,
      );
    });

    const photo = await this.prisma.photo.create({
      data: {
        id: photoId,
        ownerType: input.ownerType,
        ownerId: input.ownerId ?? null,
        storageKey: displayKey,
        thumbnailKey,
        uploadedBy: userId,
        width: processed.width,
        height: processed.height,
        mimeType: 'image/jpeg',
        fileSizeBytes: processed.display.length,
      },
    });

    // Moderate before returning — synchronous, same pattern as review/
    // contribution submission (Haiku 4.5 is fast/cheap enough to call inline).
    // The uploader still sees their own photo in the response regardless of
    // outcome (they need to see what they just uploaded); it's PUBLIC reads
    // (restaurant/review photo queries) that filter on `status: 'approved'`.
    const moderation = await this.photoModeration.check(
      this.s3.publicUrl(displayKey),
    );
    const status =
      moderation.recommendedAction === 'auto_approve'
        ? 'approved'
        : moderation.recommendedAction === 'reject'
          ? 'rejected'
          : 'pending';
    await this.prisma.photo.update({
      where: { id: photoId },
      data: { status },
    });
    await this.photoModeration.recordResult(photoId, moderation);

    return this.toDto(photo, displayKey);
  }

  async remove(
    userId: string,
    photoId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.deletedAt) {
      throw new NotFoundException('Không tìm thấy ảnh.');
    }
    if (photo.uploadedBy !== userId && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền xóa ảnh này.');
    }

    await this.prisma.photo.update({
      where: { id: photoId },
      data: { deletedAt: new Date() },
    });

    await this.s3.deleteObject(photo.storageKey).catch((error) => {
      this.logger.warn(
        `Failed to delete ${photo.storageKey} from storage: ${String(error)}`,
      );
    });
    if (photo.thumbnailKey) {
      await this.s3.deleteObject(photo.thumbnailKey).catch((error) => {
        this.logger.warn(
          `Failed to delete ${photo.thumbnailKey} from storage: ${String(error)}`,
        );
      });
    }
  }

  /**
   * Re-parents unattached photos (created before their owner existed) onto
   * a real owner, enforcing the per-owner cap. Wrapped in a transaction so
   * a cap violation rolls back the whole batch rather than partially
   * attaching photos — unless the caller passes its own `tx` (e.g.
   * ContributionService.createNewRestaurant runs restaurant-creation +
   * photo-attach + Contribution-creation as one outer transaction, so a
   * photo-cap violation here rolls back the restaurant too instead of
   * leaving an orphaned 'pending' restaurant with no Contribution/
   * ModerationResult behind it — Prisma can't nest `$transaction` calls, so
   * this must reuse the caller's client rather than opening a new one).
   */
  async reparent(
    userId: string,
    photoIds: string[],
    ownerType: MediaOwnerType,
    ownerId: string,
    tx?: Pick<PrismaService, 'photo'>,
  ): Promise<void> {
    if (photoIds.length === 0) return;

    const run = async (client: Pick<PrismaService, 'photo'>): Promise<void> => {
      await this.assertUnderCap(ownerType, ownerId, photoIds.length, client);

      const result = await client.photo.updateMany({
        where: {
          id: { in: photoIds },
          uploadedBy: userId,
          ownerId: null,
          ownerType,
        },
        data: { ownerId },
      });
      if (result.count !== photoIds.length) {
        throw new BadRequestException(
          'Một số ảnh không hợp lệ hoặc đã được gắn vào nơi khác.',
        );
      }
    };

    if (tx) {
      await run(tx);
    } else {
      await this.prisma.$transaction(run);
    }
  }

  /**
   * Attaches photos already hosted on an external, trusted origin (currently:
   * the web app's ImageKit.io upload flow) directly by URL — bypassing the
   * S3 presign/re-encode/magic-byte-sniff/AI-moderation pipeline `confirm()`
   * runs for backend-hosted uploads. That's a deliberate, scoped tradeoff
   * (see docs/build-prompts note on the ImageKit integration), not an
   * oversight — which is exactly why this only accepts URLs on the
   * configured `IMAGEKIT_URL_ENDPOINT` origin rather than arbitrary
   * caller-supplied URLs (unlike admin/photo.service.ts's `attach`, which
   * is safe to trust blindly only because it's admin/moderator-gated).
   * Same cap enforcement as `reparent`, same transactional all-or-nothing
   * semantics — and, like `reparent`, accepts the caller's own `tx` so it
   * can join an outer transaction instead of opening a nested one.
   */
  async attachExternalUrls(
    userId: string,
    ownerType: MediaOwnerType,
    ownerId: string,
    urls: string[],
    tx?: Pick<PrismaService, 'photo'>,
  ): Promise<void> {
    if (urls.length === 0) return;

    const allowedOrigin = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!allowedOrigin) {
      throw new BadRequestException(
        'External photo uploads are not configured on this server.',
      );
    }
    for (const url of urls) {
      if (!url.startsWith(allowedOrigin)) {
        throw new BadRequestException('Ảnh phải được tải lên qua ImageKit.');
      }
    }

    const run = async (client: Pick<PrismaService, 'photo'>): Promise<void> => {
      await this.assertUnderCap(ownerType, ownerId, urls.length, client);
      await client.photo.createMany({
        data: urls.map((url) => ({
          ownerType,
          ownerId,
          storageKey: url,
          uploadedBy: userId,
          status: 'approved' as const,
        })),
      });
    };

    if (tx) {
      await run(tx);
    } else {
      await this.prisma.$transaction(run);
    }
  }

  /** Hard-deletes unattached (draft) photos older than 24h — abandoned uploads. */
  async sweepOrphans(): Promise<number> {
    const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_HOURS * 60 * 60 * 1000);
    const orphans = await this.prisma.photo.findMany({
      where: { ownerId: null, createdAt: { lt: cutoff }, deletedAt: null },
    });

    for (const photo of orphans) {
      await this.s3.deleteObject(photo.storageKey).catch(() => undefined);
      if (photo.thumbnailKey) {
        await this.s3.deleteObject(photo.thumbnailKey).catch(() => undefined);
      }
    }
    if (orphans.length > 0) {
      await this.prisma.photo.deleteMany({
        where: { id: { in: orphans.map((p) => p.id) } },
      });
      this.logger.log(`Swept ${orphans.length} orphaned photo(s)`);
    }
    return orphans.length;
  }

  private async assertUnderCap(
    ownerType: MediaOwnerType,
    ownerId: string,
    incomingCount: number,
    tx: Pick<PrismaService, 'photo'> = this.prisma,
  ): Promise<void> {
    const cap = OWNER_PHOTO_CAPS[ownerType];
    const existingCount = await tx.photo.count({
      where: { ownerType, ownerId, deletedAt: null },
    });
    if (existingCount + incomingCount > cap) {
      throw new BadRequestException(`Chỉ được phép tối đa ${cap} ảnh.`);
    }
  }

  private toDto(
    photo: { id: string; width: number | null; height: number | null },
    storageKey: string,
  ): PhotoDto {
    return {
      id: photo.id,
      url: this.s3.publicUrl(storageKey),
      width: photo.width,
      height: photo.height,
    };
  }

  /**
   * Public so other modules that already depend on MediaService for
   * reparenting (e.g. ReviewService) can also resolve a raw `Photo.storageKey`
   * into a real URL without taking on a separate S3Service dependency —
   * see S3Service.publicUrl's doc comment for why this can't just be the
   * stored value verbatim.
   */
  resolveUrl(storageKey: string): string {
    return this.s3.publicUrl(storageKey);
  }
}
