import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// pg_trgm/unaccent/tsvector search + filter application + SearchHistory
// logging, per docs/build-prompts/04-search-filter.md. MediaModule
// (build-prompts/07) is imported for S3Service — resolving a Photo's
// storageKey into a real thumbnailUrl.
@Module({
  imports: [AuthModule, MediaModule], // AuthModule for JwtService (optional-auth SearchHistory attribution)
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
