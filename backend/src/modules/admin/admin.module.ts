import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { AdminRestaurantController } from './admin-restaurant.controller';
import { AdminRestaurantService } from './admin-restaurant.service';
import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './admin-user.service';
import { AuditLogService } from './audit-log.service';
import { PhotoService } from './photo.service';

// Composition layer over other modules with elevated RBAC + AuditLog, built
// incrementally starting with docs/build-prompts/05-restaurant-detail-admin-seed.md.
// AdminUserController/Service (build-prompts/08) is a gap-fix — see
// admin-user.service.ts's doc comment.
@Module({
  imports: [AuthModule, RestaurantModule],
  controllers: [AdminRestaurantController, AdminUserController],
  providers: [AdminRestaurantService, AdminUserService, AuditLogService, PhotoService],
  exports: [AuditLogService, PhotoService],
})
export class AdminModule {}
