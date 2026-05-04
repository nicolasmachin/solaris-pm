-- AlterEnum
ALTER TYPE "FileAttachmentTipo" ADD VALUE 'MINUTA_RELEVAMIENTO';

-- AlterTable
ALTER TABLE "preingenieria_versions" ADD COLUMN     "minutaExtractedAt" TIMESTAMPTZ(6),
ADD COLUMN     "minutaFileId" TEXT,
ADD COLUMN     "minutaModelUsed" TEXT;

-- CreateIndex
CREATE INDEX "preingenieria_versions_minutaFileId_idx" ON "preingenieria_versions"("minutaFileId");

-- AddForeignKey
ALTER TABLE "preingenieria_versions" ADD CONSTRAINT "preingenieria_versions_minutaFileId_fkey" FOREIGN KEY ("minutaFileId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
