import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// pg_trgm/unaccent/tsvector search + filter application + SearchHistory
// logging, per docs/build-prompts/04-search-filter.md.
@Module({
  imports: [AuthModule], // for JwtService (optional-auth SearchHistory attribution)
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
