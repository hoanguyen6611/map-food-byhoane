-- AlterTable
ALTER TABLE "opening_hours" ADD COLUMN     "close_time_2" TIME,
ADD COLUMN     "is_open_24h" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "open_time_2" TIME;
