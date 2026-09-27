-- CreateTable
CREATE TABLE "restaurant_daily_stats" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "restaurant_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_daily_stats_restaurant_id_date_key" ON "restaurant_daily_stats"("restaurant_id", "date");

-- CreateIndex
CREATE INDEX "restaurant_daily_stats_date_idx" ON "restaurant_daily_stats"("date");

-- AddForeignKey
ALTER TABLE "restaurant_daily_stats" ADD CONSTRAINT "restaurant_daily_stats_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
