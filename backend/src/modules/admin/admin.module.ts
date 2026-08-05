import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ContributionModule } from '../contribution/contribution.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminRestaurantController } from './admin-restaurant.controller';
import { AdminRestaurantService } from './admin-restaurant.service';
import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './admin-user.service';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';
import { AuditLogService } from './audit-log.service';
import { PhotoService } from './photo.service';

// Composition layer over other modules with elevated RBAC + AuditLog, built
// incrementally starting with docs/build-prompts/05-restaurant-detail-admin-seed.md.
// AdminUserController/Service (build-prompts/08) is a gap-fix — see
// admin-user.service.ts's doc comment. AdminModerationController/Service
// (build-prompts/07) is the Admin Moderation Queue — imports ModerationModule
// (ReportService), ContributionModule (ContributionFinalizeService, so
// "what does approving X actually do" lives in one place), and
// NotificationModule (first real producer of Notification rows).
@Module({
  imports: [AuthModule, RestaurantModule, ModerationModule, ContributionModule, NotificationModule],
  controllers: [AdminRestaurantController, AdminUserController, AdminModerationController],
  providers: [AdminRestaurantService, AdminUserService, AdminModerationService, AuditLogService, PhotoService],
  exports: [AuditLogService, PhotoService],
})
export class AdminModule {}
