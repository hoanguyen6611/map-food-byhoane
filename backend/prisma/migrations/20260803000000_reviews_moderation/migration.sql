-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'published', 'rejected', 'hidden');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('review', 'contribution', 'photo', 'video');

-- CreateEnum
CREATE TYPE "ModerationRecommendedAction" AS ENUM ('auto_approve', 'hold_for_review', 'reject');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('pending', 'approved', 'rejected', 'edit_requested');

-- CreateTable
CREATE TABLE "review_criteria" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "applies_to_category_id" TEXT,

    CONSTRAINT "review_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "comment" TEXT,
    "dishes_ordered" TEXT[],
    "bill_total_vnd" INTEGER,
    "party_size" INTEGER,
    "visited_at" TIMESTAMP(3),
    "wait_time_minutes" INTEGER,
    "would_return" BOOLEAN,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_ratings" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "criteria_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "review_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_results" (
    "id" TEXT NOT NULL,
    "target_type" "ModerationTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "risk_score" DECIMAL(3,2) NOT NULL,
    "labels" TEXT[],
    "ai_reason" TEXT NOT NULL,
    "recommended_action" "ModerationRecommendedAction" NOT NULL,
    "decided_by" TEXT,
    "decision" "ModerationDecision" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMP(3),
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_criteria_code_key" ON "review_criteria"("code");

-- CreateIndex
CREATE INDEX "reviews_restaurant_id_status_idx" ON "reviews"("restaurant_id", "status");

-- CreateIndex
-- Hand-written: enforces "one active review per user per restaurant"
-- (docs/06-database-erd.md §5) as a PARTIAL unique index, which Prisma's
-- schema DSL cannot express (same category of hand-written SQL as the
-- geo/trigram indexes noted at the top of schema.prisma). A plain
-- (user_id, restaurant_id) unique index would wrongly block a new review
-- after a prior one was soft-deleted, so the WHERE clause is required.
CREATE UNIQUE INDEX "reviews_user_id_restaurant_id_active_key" ON "reviews"("user_id", "restaurant_id") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "review_ratings_review_id_criteria_id_key" ON "review_ratings"("review_id", "criteria_id");

-- CreateIndex
CREATE INDEX "moderation_results_target_type_target_id_idx" ON "moderation_results"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "moderation_results_decision_idx" ON "moderation_results"("decision");

-- AddForeignKey
ALTER TABLE "review_criteria" ADD CONSTRAINT "review_criteria_applies_to_category_id_fkey" FOREIGN KEY ("applies_to_category_id") REFERENCES "restaurant_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ratings" ADD CONSTRAINT "review_ratings_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ratings" ADD CONSTRAINT "review_ratings_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "review_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
