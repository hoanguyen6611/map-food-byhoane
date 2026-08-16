-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "photos" ADD COLUMN "status" "PhotoStatus" NOT NULL DEFAULT 'pending';

-- Backfill: every photo that existed before this migration was created
-- either by the pre-moderation upload flow or the admin-only URL-attach
-- flow, both effectively trusted at the time — mark them approved so
-- existing restaurants/reviews don't suddenly lose their photos.
UPDATE "photos" SET "status" = 'approved';
