import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

// Read paths (nearby/bounds) implemented by docs/build-prompts/03-map-geospatial.md.
// Detail + admin CRUD land in docs/build-prompts/05-restaurant-detail-admin-seed.md.
@Module({
  controllers: [RestaurantController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
