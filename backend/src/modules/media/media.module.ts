import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';
import { PhotoCleanupProcessor, PHOTO_CLEANUP_QUEUE } from './photo-cleanup.processor';

// Real signed-upload pipeline (build-prompts/07-contribution-media-moderation-ai.md):
// signed upload URLs, server-side re-encode + magic-byte validation,
// thumbnails, and a background sweep for abandoned (never-attached) uploads.
@Module({
  imports: [BullModule.registerQueue({ name: PHOTO_CLEANUP_QUEUE })],
  controllers: [MediaController],
  providers: [MediaService, S3Service, PhotoCleanupProcessor],
  // S3Service exported too — RestaurantService needs it directly to
  // resolve Photo.storageKey into a real URL (see S3Service.publicUrl's
  // doc comment) without depending on the rest of MediaService's surface.
  exports: [MediaService, S3Service],
})
export class MediaModule {}
