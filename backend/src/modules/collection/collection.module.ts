import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

// User-created restaurant lists ("Bộ sưu tập"). AuthModule re-exports
// JwtModule, used by CollectionController's optional-auth GET :id (same
// recipe as SearchController/UserPublicController). MediaModule for
// MediaService.resolveUrl (item thumbnails).
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [CollectionController],
  providers: [CollectionService],
})
export class CollectionModule {}
