import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { AdminRestaurantController } from './admin-restaurant.controller';
import { AdminRestaurantService } from './admin-restaurant.service';
import { AuditLogService } from './audit-log.service';
import { PhotoService } from './photo.service';

// Composition layer over other modules with elevated RBAC + AuditLog, built
// incrementally starting with docs/build-prompts/05-restaurant-detail-admin-seed.md.
@Module({
  imports: [AuthModule, RestaurantModule],
  controllers: [AdminRestaurantController],
  providers: [AdminRestaurantService, AuditLogService, PhotoService],
  exports: [AuditLogService, PhotoService],
})
export class AdminModule {}
