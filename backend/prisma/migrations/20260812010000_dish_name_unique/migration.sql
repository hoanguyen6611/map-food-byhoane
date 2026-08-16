-- AlterTable
-- `dishes` has zero rows in every known environment (confirmed before
-- writing this migration), so a unique constraint is safe to add directly
-- with no backfill/dedup step needed.
CREATE UNIQUE INDEX "dishes_name_key" ON "dishes"("name");
