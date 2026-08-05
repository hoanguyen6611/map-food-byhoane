-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('new_restaurant', 'edit_suggestion', 'status_update', 'closure_report');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pending', 'auto_approved', 'in_review', 'approved', 'rejected', 'edit_requested');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('restaurant', 'review');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'inappropriate', 'incorrect_info', 'duplicate', 'closed_down', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'escalated', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "CrowdedLevel" AS ENUM ('empty', 'light', 'moderate', 'crowded', 'full');

-- CreateEnum
CREATE TYPE "SeatAvailabilityLevel" AS ENUM ('plenty', 'limited', 'full');

-- CreateEnum
CREATE TYPE "PowerOutletLevel" AS ENUM ('plenty', 'some', 'none');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhotoOwnerType" ADD VALUE 'review';
ALTER TYPE "PhotoOwnerType" ADD VALUE 'contribution';

-- NOTE: Prisma's diff engine proposed dropping the hand-written GIST/trigram/
-- tsvector indexes below because they're declared `Unsupported(...)` and
-- invisible to it (see schema.prisma's top-of-file caveat comment). Stripped
-- from this migration — do not drop them:
--   DROP INDEX "locations_geo_point_gist_idx";
--   DROP INDEX "restaurants_name_trgm_idx";
--   DROP INDEX "restaurants_search_vector_idx";
-- Same reason the diff also proposed `ALTER TABLE "restaurants" ALTER COLUMN
-- "search_vector" DROP DEFAULT;` — search_vector is a GENERATED ALWAYS AS
-- STORED column, not a plain column with a default; also stripped.

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "file_size_bytes" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "moderation_result_id" TEXT,
ALTER COLUMN "owner_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "target_restaurant_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pending',
    "moderation_result_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_suggestions" (
    "id" TEXT NOT NULL,
    "contribution_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB NOT NULL,

    CONSTRAINT "edit_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_summaries" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "pros" TEXT[],
    "cons" TEXT[],
    "source_review_count" INTEGER NOT NULL,
    "model_version" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crowded_statuses" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "level" "CrowdedLevel" NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crowded_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_availabilities" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "level" "SeatAvailabilityLevel" NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "power_outlet_statuses" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "level" "PowerOutletLevel" NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "power_outlet_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_information" (
    "restaurant_id" TEXT NOT NULL,
    "has_car_parking" BOOLEAN NOT NULL,
    "has_motorbike_parking" BOOLEAN NOT NULL,
    "is_free" BOOLEAN,
    "notes" TEXT,
    "last_updated_by" TEXT,
    "last_updated_at" TIMESTAMP(3),

    CONSTRAINT "parking_information_pkey" PRIMARY KEY ("restaurant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contributions_moderation_result_id_key" ON "contributions"("moderation_result_id");

-- CreateIndex
CREATE INDEX "contributions_user_id_status_idx" ON "contributions"("user_id", "status");

-- CreateIndex
CREATE INDEX "contributions_target_restaurant_id_idx" ON "contributions"("target_restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "edit_suggestions_contribution_id_key" ON "edit_suggestions"("contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_target_type_target_id_key" ON "reports"("reporter_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_summaries_restaurant_id_key" ON "ai_summaries"("restaurant_id");

-- CreateIndex
CREATE INDEX "crowded_statuses_restaurant_id_reported_at_idx" ON "crowded_statuses"("restaurant_id", "reported_at");

-- CreateIndex
CREATE INDEX "seat_availabilities_restaurant_id_reported_at_idx" ON "seat_availabilities"("restaurant_id", "reported_at");

-- CreateIndex
CREATE INDEX "power_outlet_statuses_restaurant_id_reported_at_idx" ON "power_outlet_statuses"("restaurant_id", "reported_at");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_moderation_result_id_fkey" FOREIGN KEY ("moderation_result_id") REFERENCES "moderation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_target_restaurant_id_fkey" FOREIGN KEY ("target_restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_moderation_result_id_fkey" FOREIGN KEY ("moderation_result_id") REFERENCES "moderation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_suggestions" ADD CONSTRAINT "edit_suggestions_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowded_statuses" ADD CONSTRAINT "crowded_statuses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowded_statuses" ADD CONSTRAINT "crowded_statuses_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_availabilities" ADD CONSTRAINT "seat_availabilities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_availabilities" ADD CONSTRAINT "seat_availabilities_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_outlet_statuses" ADD CONSTRAINT "power_outlet_statuses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_outlet_statuses" ADD CONSTRAINT "power_outlet_statuses_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_information" ADD CONSTRAINT "parking_information_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_information" ADD CONSTRAINT "parking_information_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hard-rule enforcement (docs/06-database-erd.md §7, Definition of Done):
-- recommendedAction=reject or a risk score at/above the medium-risk
-- threshold can never reach decision=approved without a real moderator
-- (decided_by non-null). This is the DB-level twin of
-- moderation-decision.util.ts's assertDecisionAllowed() — independent of
-- any application code, so it can't be bypassed by a future bug anywhere
-- in the codebase. 0.50 mirrors MEDIUM_RISK_THRESHOLD in
-- rule-based-moderation.util.ts; keep both in sync if that constant ever changes.
ALTER TABLE "moderation_results" ADD CONSTRAINT "moderation_results_hard_rule_chk"
CHECK (
  decision <> 'approved'
  OR decided_by IS NOT NULL
  OR (recommended_action = 'auto_approve' AND risk_score < 0.50)
);
