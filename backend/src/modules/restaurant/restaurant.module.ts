import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

// Read paths (nearby/bounds) implemented by docs/build-prompts/03-map-geospatial.md.
// Detail + admin CRUD land in docs/build-prompts/05-restaurant-detail-admin-seed.md.
// MediaModule (build-prompts/07) is imported for S3Service — resolving a
// Photo's storageKey into a real URL (see S3Service.publicUrl's doc comment).
// CatalogController/Service (categories/facilities lookup lists) lives here
// rather than its own module — it's small, restaurant-scoped reference
// data, same rationale as everything else in this module.
@Module({
  imports: [MediaModule],
  controllers: [RestaurantController, CatalogController],
  providers: [RestaurantService, CatalogService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
