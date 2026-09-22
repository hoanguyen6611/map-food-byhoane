-- Profile-page redesign: username/social-links/cuisine-prefs/public-toggle
-- on user_profiles, plus real per-user helpful-vote and reply tables for
-- reviews (replacing the previously presentational-only "Hữu ích" button).
-- Levels/points/badges are NOT stored anywhere — computed live from real
-- counts on these + existing tables (see GamificationService).

ALTER TABLE "user_profiles" ADD COLUMN "username" TEXT;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");
ALTER TABLE "user_profiles" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_profiles" ADD COLUMN "facebook_url" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "instagram_url" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "favorite_cuisines" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE "review_helpful_votes" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_helpful_votes_review_id_user_id_key" ON "review_helpful_votes"("review_id", "user_id");

ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_replies" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_replies_review_id_idx" ON "review_replies"("review_id");

ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
