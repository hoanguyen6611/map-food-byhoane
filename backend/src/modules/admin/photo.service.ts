import { Injectable, NotFoundException } from '@nestjs/common';
import type { PhotoOwnerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AttachPhotoInput {
  ownerType: PhotoOwnerType;
  ownerId: string;
  url: string;
  width?: number;
  height?: number;
  uploadedBy?: string;
}

/**
 * Minimal admin-only photo attachment — a deliberate stopgap per
 * docs/build-prompts/05's scope note: no real object storage / signed-upload
 * pipeline exists until build-prompts/07's MediaModule (compression,
 * magic-byte validation, thumbnails). `storageKey` holds the admin-supplied
 * URL directly and is resolved as-is by clients — there is no re-encoding or
 * security hardening here, which is acceptable ONLY because this endpoint is
 * admin/moderator-only (see PhotoController's guards), never open to
 * arbitrary user input.
 */
@Injectable()
export class PhotoService {
  constructor(private readonly prisma: PrismaService) {}

  async attach(input: AttachPhotoInput) {
    return this.prisma.photo.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        storageKey: input.url,
        width: input.width,
        height: input.height,
        uploadedBy: input.uploadedBy,
      },
    });
  }

  async remove(photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.deletedAt) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
    await this.prisma.photo.update({ where: { id: photoId }, data: { deletedAt: new Date() } });
  }

  async findForOwner(ownerType: PhotoOwnerType, ownerId: string) {
    return this.prisma.photo.findMany({
      where: { ownerType, ownerId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }
}
