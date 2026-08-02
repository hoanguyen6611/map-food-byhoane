import { Controller, Get, Param, Query } from '@nestjs/common';
import type { RestaurantDetailDto, RestaurantSummaryDto } from '@foodmap/shared-types';
import { RestaurantService } from './restaurant.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { BoundsQueryDto } from './dto/bounds-query.dto';

@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  // Literal routes ('nearby', 'bounds') MUST stay declared before the ':id'
  // catch-all below, or NestJS would match e.g. GET /restaurants/nearby to
  // the :id handler with id="nearby" instead.
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto): Promise<RestaurantSummaryDto[]> {
    return this.restaurantService.findNearby(query.lat, query.lng, query.radiusKm);
  }

  @Get('bounds')
  findInBounds(@Query() query: BoundsQueryDto): Promise<RestaurantSummaryDto[]> {
    return this.restaurantService.findInBounds(query.swLat, query.swLng, query.neLat, query.neLng);
  }

  @Get(':id')
  getDetail(@Param('id') id: string): Promise<RestaurantDetailDto> {
    return this.restaurantService.getDetail(id);
  }
}
