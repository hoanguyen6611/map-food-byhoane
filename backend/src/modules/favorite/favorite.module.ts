import { Module } from '@nestjs/common';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';

// Implements docs/build-prompts/08-favorites-notifications-polish.md's
// Favorite scope: idempotent add/remove, paginated list.
@Module({
  controllers: [FavoriteController],
  providers: [FavoriteService],
})
export class FavoriteModule {}
