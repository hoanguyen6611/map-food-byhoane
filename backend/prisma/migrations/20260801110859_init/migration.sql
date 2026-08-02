-- Extensions required by docs/06-database-erd.md (PostGIS geospatial types +
-- Vietnamese-diacritics-insensitive fuzzy search, per docs/05-system-architecture.md §6-7)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple', 'none');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('guest', 'user', 'moderator', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "RestaurantPublicationStatus" AS ENUM ('pending', 'in_review', 'published', 'rejected', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('wifi', 'parking_car', 'parking_motorbike', 'air_conditioner', 'outdoor_seating', 'kid_friendly', 'pet_friendly', 'card_payment', 'private_room');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "oauth_provider" "OAuthProvider" NOT NULL DEFAULT 'none',
    "oauth_subject_id" TEXT,
    "phone" TEXT,
    "role_id" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_photo_id" TEXT,
    "bio" TEXT,
    "home_city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "restaurant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_cuisines" (
    "restaurant_id" TEXT NOT NULL,
    "cuisine_id" TEXT NOT NULL,

    CONSTRAINT "restaurant_cuisines_pkey" PRIMARY KEY ("restaurant_id","cuisine_id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine_id" TEXT,
    "alias_keywords" TEXT[],

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_ranges" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "min_vnd" INTEGER NOT NULL,
    "max_vnd" INTEGER,

    CONSTRAINT "price_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "full_address_text" TEXT NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "geo_point" geography(Point, 4326),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT NOT NULL,
    "price_range_id" TEXT,
    "phone" TEXT,
    "address_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "submitted_by" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_status" (
    "restaurant_id" TEXT NOT NULL,
    "publication_status" "RestaurantPublicationStatus" NOT NULL DEFAULT 'pending',
    "composite_score" DECIMAL(3,2),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "last_review_at" TIMESTAMP(3),
    "last_computed_at" TIMESTAMP(3),

    CONSTRAINT "restaurant_status_pkey" PRIMARY KEY ("restaurant_id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TIME,
    "close_time" TIME,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_facilities" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "facility_type" "FacilityType" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "restaurant_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "dish_id" TEXT,
    "name" TEXT NOT NULL,
    "price_vnd" INTEGER NOT NULL,
    "photo_id" TEXT,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_provider_oauth_subject_id_key" ON "users"("oauth_provider", "oauth_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_categories_code_key" ON "restaurant_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_code_key" ON "cuisines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "price_ranges_code_key" ON "price_ranges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_address_id_key" ON "restaurants"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_location_id_key" ON "restaurants"("location_id");

-- CreateIndex
CREATE INDEX "restaurants_category_id_idx" ON "restaurants"("category_id");

-- CreateIndex
CREATE INDEX "restaurants_price_range_id_idx" ON "restaurants"("price_range_id");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_restaurant_id_day_of_week_key" ON "opening_hours"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_facilities_restaurant_id_facility_type_key" ON "restaurant_facilities"("restaurant_id", "facility_type");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cuisines" ADD CONSTRAINT "restaurant_cuisines_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_cuisines" ADD CONSTRAINT "restaurant_cuisines_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "cuisines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "cuisines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "restaurant_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_price_range_id_fkey" FOREIGN KEY ("price_range_id") REFERENCES "price_ranges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_status" ADD CONSTRAINT "restaurant_status_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_facilities" ADD CONSTRAINT "restaurant_facilities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Geospatial index: enables ST_DWithin/bounding-box queries used by
-- build-prompts/03-map-geospatial.md (docs/05-system-architecture.md §6).
CREATE INDEX "locations_geo_point_gist_idx" ON "locations" USING GIST ("geo_point");

-- Trigram index: enables fuzzy/diacritics-insensitive restaurant name search
-- used by build-prompts/04-search-filter.md (docs/05-system-architecture.md §7).
CREATE INDEX "restaurants_name_trgm_idx" ON "restaurants" USING GIN ("name" gin_trgm_ops);

-- Keep locations.geo_point in sync with lat/lng automatically. Prisma Client
-- has no first-class PostGIS type (see schema.prisma header comment), so
-- geo_point is derived server-side rather than set through the ORM.
CREATE OR REPLACE FUNCTION sync_location_geo_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geo_point := ST_SetSRID(ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER locations_sync_geo_point
BEFORE INSERT OR UPDATE OF lat, lng ON "locations"
FOR EACH ROW
EXECUTE FUNCTION sync_location_geo_point();
