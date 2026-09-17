import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  AISummaryResponseDto,
  RestaurantDetailDto,
  RestaurantSitemapEntryDto,
  RestaurantSummaryDto,
} from '@foodmap/shared-types';
import { RestaurantService } from './restaurant.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { BoundsQueryDto } from './dto/bounds-query.dto';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  // Literal routes ('nearby', 'bounds', 'sitemap-index', 'slug') MUST stay
  // declared before the ':id' catch-all below, or NestJS would match e.g.
  // GET /restaurants/nearby to the :id handler with id="nearby" instead.
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto): Promise<RestaurantSummaryDto[]> {
    return this.restaurantService.findNearby(
      query.lat,
      query.lng,
      query.radiusKm,
    );
  }

  @Get('bounds')
  findInBounds(
    @Query() query: BoundsQueryDto,
  ): Promise<RestaurantSummaryDto[]> {
    return this.restaurantService.findInBounds(
      query.swLat,
      query.swLng,
      query.neLat,
      query.neLng,
    );
  }

  // Consumed by the public web app's sitemap.xml (build-prompts/09) — every
  // published restaurant's slug + last-updated timestamp, nothing else.
  @Get('sitemap-index')
  listSitemapIndex(): Promise<RestaurantSitemapEntryDto[]> {
    return this.restaurantService.listPublishedSlugs();
  }

  // build-prompts/09's clean-URL lookup path — see
  // RestaurantService.getDetailBySlug's doc comment.
  @Get('slug/:slug')
  getDetailBySlug(@Param('slug') slug: string): Promise<RestaurantDetailDto> {
    return this.restaurantService.getDetailBySlug(slug);
  }

  @Get(':id')
  getDetail(@Param('id') id: string): Promise<RestaurantDetailDto> {
    return this.restaurantService.getDetail(id);
  }

  // US-J1/J2 — read-side only, no real Claude summarize() call (see
  // ai-summary-trigger.stub.ts). Unambiguous alongside the ':id' route
  // above regardless of declaration order — different segment count.
  @Get(':id/ai-summary')
  getAiSummary(@Param('id') id: string): Promise<AISummaryResponseDto> {
    return this.restaurantService.getAiSummary(id);
  }
}
