-- Adds a raw page-view counter to restaurant_status, incremented on every
-- public detail-page load (RestaurantService.getDetail/getDetailBySlug).
-- Every existing row backfills to 0 via the column default — no historical
-- view data exists to backfill from.
ALTER TABLE "restaurant_status" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
