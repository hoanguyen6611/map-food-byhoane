import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

// Read paths (nearby/bounds) implemented by docs/build-prompts/03-map-geospatial.md.
// Detail + admin CRUD land in docs/build-prompts/05-restaurant-detail-admin-seed.md.
// MediaModule (build-prompts/07) is imported for S3Service — resolving a
// Photo's storageKey into a real URL (see S3Service.publicUrl's doc comment).
@Module({
  imports: [MediaModule],
  controllers: [RestaurantController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
