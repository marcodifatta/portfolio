-- CreateTable
CREATE TABLE "bio_links" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "icon_path" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bio_links_visible_position_idx" ON "bio_links"("visible", "position");
