-- New notification types for the social/activity features added this
-- session: a helpful vote on your review, a review crossing the
-- helpful-vote milestone, and a favorited restaurant changing its hours.
ALTER TYPE "NotificationType" ADD VALUE 'review_helpful_vote';
ALTER TYPE "NotificationType" ADD VALUE 'review_helpful_milestone';
ALTER TYPE "NotificationType" ADD VALUE 'restaurant_hours_changed';
