-- CreateEnum
CREATE TYPE "FileSource" AS ENUM ('UPLOAD', 'URL');

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "source" "FileSource" NOT NULL,
    "sourceUrl" TEXT,
    "deleteTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_slug_key" ON "files"("slug");

-- CreateIndex
CREATE INDEX "files_expiresAt_idx" ON "files"("expiresAt");
