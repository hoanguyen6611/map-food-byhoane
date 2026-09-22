import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { MediaController, MyPhotoController } from './media.controller';
import { MediaService } from './media.service';
import { PhotoModerationService } from './photo-moderation.service';
import { S3Service } from './s3.service';
import {
  PhotoCleanupProcessor,
  PHOTO_CLEANUP_QUEUE,
} from './photo-cleanup.processor';

// Real signed-upload pipeline (build-prompts/07-contribution-media-moderation-ai.md):
// signed upload URLs, server-side re-encode + magic-byte validation,
// thumbnails, moderation (PhotoModerationService, gap-fix — see its doc
// comment), and a background sweep for abandoned (never-attached) uploads.
// AiModule is imported for ClaudeGatewayService (PhotoModerationService).
@Module({
  imports: [BullModule.registerQueue({ name: PHOTO_CLEANUP_QUEUE }), AiModule],
  controllers: [MediaController, MyPhotoController],
  providers: [
    MediaService,
    S3Service,
    PhotoCleanupProcessor,
    PhotoModerationService,
  ],
  // S3Service exported too — RestaurantService needs it directly to
  // resolve Photo.storageKey into a real URL (see S3Service.publicUrl's
  // doc comment) without depending on the rest of MediaService's surface.
  exports: [MediaService, S3Service],
})
export class MediaModule {}
