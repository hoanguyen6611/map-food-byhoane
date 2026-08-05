import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';

// Implements docs/build-prompts/08-favorites-notifications-polish.md's
// Favorite scope: idempotent add/remove, paginated list. MediaModule
// (build-prompts/07) is imported for S3Service — resolving a Photo's
// storageKey into a real thumbnailUrl.
@Module({
  imports: [MediaModule],
  controllers: [FavoriteController],
  providers: [FavoriteService],
})
export class FavoriteModule {}
