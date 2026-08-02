-- NOTE: Prisma's diff engine proposed dropping the two pre-existing hand-written
-- indexes (locations_geo_point_gist_idx, restaurants_name_trgm_idx) here —
-- drift-detection noise, not an intended change. Removed on purpose; see
-- docs/build-prompts/03-map-geospatial.md, which depends on both.

-- Postgres's built-in unaccent() is not marked IMMUTABLE (its behavior could
-- in principle depend on search_path / the active text search dictionary),
-- so Postgres refuses to use it directly inside a GENERATED ALWAYS AS STORED
-- expression ("generation expression is not immutable"). The standard,
-- widely-used workaround: wrap it in a same-behavior function explicitly
-- declared IMMUTABLE, pinned to the 'unaccent' dictionary specifically so
-- its behavior genuinely can't change out from under us.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- AlterTable: generated STORED column, not a plain column — Prisma's diff
-- can't express GENERATED ALWAYS AS, so this replaces its plain `ADD COLUMN`.
-- Weighted so an exact name match (weight A) ranks above a description match
-- (weight B) in ts_rank_cd ordering (see SearchService).
ALTER TABLE "restaurants" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce("description", ''))), 'B')
  ) STORED;

CREATE INDEX "restaurants_search_vector_idx" ON "restaurants" USING GIN ("search_vector");

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "device_id" TEXT,
    "query_text" TEXT,
    "applied_filters" JSONB,
    "result_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_history_user_id_idx" ON "search_history"("user_id");

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
