import { Controller, Get, Headers, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Paginated, RestaurantSummaryDto } from '@foodmap/shared-types';
import type { JwtPayload } from '../auth/auth.types';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly jwt: JwtService,
  ) {}

  @Get('search')
  search(
    @Query() query: SearchQueryDto,
    @Headers('authorization') authHeader?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Paginated<RestaurantSummaryDto>> {
    return this.searchService.search(query, {
      userId: this.tryExtractUserId(authHeader),
      deviceId,
    });
  }

  // `GET /restaurants` (browse-with-filters, no `q`) — deliberately the same
  // handler/DTO as `/search`; a caller simply omits `q`. Kept on this
  // controller (not RestaurantModule's) because it shares 100% of its
  // implementation with /search — see build-prompts/04's scope note.
  @Get('restaurants')
  browse(
    @Query() query: SearchQueryDto,
    @Headers('authorization') authHeader?: string,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<Paginated<RestaurantSummaryDto>> {
    return this.searchService.search(query, {
      userId: this.tryExtractUserId(authHeader),
      deviceId,
    });
  }

  // Search is public (guests can search per docs/01-prd-mvp.md), but we still
  // want to attribute SearchHistory to a logged-in user when possible — so
  // this is a best-effort decode, never a hard auth requirement (no guard).
  private tryExtractUserId(authHeader?: string): string | undefined {
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<JwtPayload>(
        authHeader.slice('Bearer '.length),
      );
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
