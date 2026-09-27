-- Adds the "review_reply" notification type, fired when someone (not the
-- review's own author) replies to a review — see ReviewService.notifyReply.
ALTER TYPE "NotificationType" ADD VALUE 'review_reply';
