import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushTokenController } from './push-token.controller';
import { PushDeliveryService } from './push-delivery.service';

// Implemented by docs/build-prompts/08-favorites-notifications-polish.md —
// transactional Notification read/write API. The Admin Moderation Queue's
// decision endpoint (build-prompts/07) is the first real producer — see
// NotificationService.create(), exported here for AdminModerationModule to inject.
// PushDeliveryService/PushTokenController live here rather than a separate
// module: NotificationService.create() is push delivery's only call site, so
// the two are one cohesive unit, not independent domains.
@Module({
  controllers: [NotificationController, PushTokenController],
  providers: [NotificationService, PushDeliveryService],
  exports: [NotificationService],
})
export class NotificationModule {}
