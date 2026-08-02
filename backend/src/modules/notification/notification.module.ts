import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

// Implemented by docs/build-prompts/08-favorites-notifications-polish.md —
// transactional Notification read/write API. No producer exists yet
// (Module 7's moderation queue isn't built) — see notification.ts in
// shared-types and prisma/seed-notifications.ts for the demo-data stopgap.
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
