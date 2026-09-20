-- User/admin-chosen "ảnh đại diện" (cover photo) — nullable, so every
-- existing restaurant just keeps today's behavior (oldest approved photo as
-- thumbnail) until someone explicitly picks one. ON DELETE SET NULL: removing
-- the chosen photo falls back to that same old behavior instead of leaving a
-- dangling reference or blocking the photo delete.
ALTER TABLE "restaurants" ADD COLUMN "cover_photo_id" TEXT;
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_cover_photo_id_key" UNIQUE ("cover_photo_id");
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_cover_photo_id_fkey" FOREIGN KEY ("cover_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
