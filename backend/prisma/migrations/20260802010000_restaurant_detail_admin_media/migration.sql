-- NOTE: Prisma's diff engine proposed dropping the three pre-existing
-- hand-written indexes (locations_geo_point_gist_idx, restaurants_name_trgm_idx,
-- restaurants_search_vector_idx) and an `ALTER COLUMN search_vector DROP
-- DEFAULT` here — all drift-detection noise from raw-SQL objects Prisma's
-- schema can't fully represent (see schema.prisma's caveat comment near the
-- top). Removed on purpose; do not actually apply them.

-- CreateEnum
CREATE TYPE "PhotoOwnerType" AS ENUM ('restaurant', 'menu_item', 'user_profile');

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "owner_type" "PhotoOwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumbnail_key" TEXT,
    "uploaded_by" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photos_owner_type_owner_id_idx" ON "photos"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_idx" ON "audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
