import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

// Implemented by docs/build-prompts/08-favorites-notifications-polish.md —
// transactional Notification read/write API. The Admin Moderation Queue's
// decision endpoint (build-prompts/07) is the first real producer — see
// NotificationService.create(), exported here for AdminModerationModule to inject.
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
