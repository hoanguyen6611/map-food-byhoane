-- Adds the "new_follower" notification type, fired when someone follows a
-- user (FollowService.follow) — see NotificationType's schema.prisma comment.
ALTER TYPE "NotificationType" ADD VALUE 'new_follower';
