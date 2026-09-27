import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';

// User-to-user "Theo dõi" relationship backing web's /profile/[id] page —
// see packages/shared-types/src/social.ts. NotificationModule imported for
// NotificationService.create() (the new_follower notification).
@Module({
  imports: [NotificationModule],
  controllers: [FollowController],
  providers: [FollowService],
})
export class FollowModule {}
