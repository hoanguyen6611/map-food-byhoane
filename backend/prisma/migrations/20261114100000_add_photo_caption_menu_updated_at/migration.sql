-- IF NOT EXISTS: photos.caption was already added to the live database
-- outside migrations (db push / manual), which made this fail with 42701.
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "menus" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
