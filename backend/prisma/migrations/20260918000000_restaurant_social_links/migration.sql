-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "facebook_url" TEXT,
ADD COLUMN     "facebook_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instagram_url" TEXT,
ADD COLUMN     "instagram_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktok_url" TEXT,
ADD COLUMN     "website_url" TEXT;
