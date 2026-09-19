-- Converts FacilityType from a fixed Postgres enum into a real lookup
-- table (facilities), so it can be managed via admin CRUD at runtime like
-- restaurant_categories/cuisines already are. Data-preserving: existing
-- restaurant_facilities rows keep their exact facility value, just as a
-- plain code string (FK to facilities.code) instead of an enum value.

-- 1. New lookup table.
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "facilities_code_key" ON "facilities"("code");

-- 2. Seed it with the exact 9 existing enum values (same codes, same
-- Vietnamese labels admin-web has hardcoded until now).
INSERT INTO "facilities" ("id", "code", "label") VALUES
    (gen_random_uuid()::text, 'wifi', 'Wifi'),
    (gen_random_uuid()::text, 'parking_car', 'Chỗ đậu ô tô'),
    (gen_random_uuid()::text, 'parking_motorbike', 'Chỗ đậu xe máy'),
    (gen_random_uuid()::text, 'air_conditioner', 'Điều hòa'),
    (gen_random_uuid()::text, 'outdoor_seating', 'Chỗ ngồi ngoài trời'),
    (gen_random_uuid()::text, 'kid_friendly', 'Thân thiện trẻ em'),
    (gen_random_uuid()::text, 'pet_friendly', 'Cho phép thú cưng'),
    (gen_random_uuid()::text, 'card_payment', 'Thanh toán thẻ'),
    (gen_random_uuid()::text, 'private_room', 'Phòng riêng');

-- 3. Add the new column nullable first, backfill from the enum column,
-- then tighten to NOT NULL — this is the step Prisma's own naive diff
-- can't express (it would add facility_code as NOT NULL with no backfill,
-- which errors on any existing row and loses data either way).
ALTER TABLE "restaurant_facilities" ADD COLUMN "facility_code" TEXT;
UPDATE "restaurant_facilities" SET "facility_code" = "facility_type"::text;
ALTER TABLE "restaurant_facilities" ALTER COLUMN "facility_code" SET NOT NULL;

-- 4. Swap the unique constraint and FK from the old enum column to the new one.
DROP INDEX "restaurant_facilities_restaurant_id_facility_type_key";
ALTER TABLE "restaurant_facilities" DROP COLUMN "facility_type";
CREATE UNIQUE INDEX "restaurant_facilities_restaurant_id_facility_code_key" ON "restaurant_facilities"("restaurant_id", "facility_code");
ALTER TABLE "restaurant_facilities" ADD CONSTRAINT "restaurant_facilities_facility_code_fkey" FOREIGN KEY ("facility_code") REFERENCES "facilities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. The enum type itself is no longer referenced by any column — safe to drop.
DROP TYPE "FacilityType";
