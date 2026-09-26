-- User-proposed cuisine/facility entries (Add Restaurant form's "+ Thêm
-- mới") start hidden from the public catalog until the restaurant that
-- proposed them is approved. Existing rows all default to true (every
-- current row was admin-created, already public) — no backfill needed
-- beyond the column default.
ALTER TABLE "cuisines" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "facilities" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true;
