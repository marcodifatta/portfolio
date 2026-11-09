-- CreateTable
CREATE TABLE "admin_credentials" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "password_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id")
);
