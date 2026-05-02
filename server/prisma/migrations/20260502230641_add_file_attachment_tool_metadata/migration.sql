-- AlterTable
ALTER TABLE "file_attachments" ADD COLUMN     "toolEntityId" TEXT,
ADD COLUMN     "toolSource" TEXT,
ADD COLUMN     "toolVersion" INTEGER;

-- CreateIndex
CREATE INDEX "file_attachments_toolSource_idx" ON "file_attachments"("toolSource");
