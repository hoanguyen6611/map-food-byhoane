-- Photo caption for the web's full-screen photo viewer.
ALTER TABLE "photos" ADD COLUMN "caption" TEXT;

-- Menu last-updated timestamp ("cập nhật 10/2026" on the public menu card).
ALTER TABLE "menus" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
