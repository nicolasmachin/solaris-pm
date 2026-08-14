-- AlterTable
ALTER TABLE "proposal_defaults" ADD COLUMN     "coverEmpresaOverlay" JSONB,
ADD COLUMN     "coverEmpresaPdfAttachmentId" TEXT;

-- AddForeignKey
ALTER TABLE "proposal_defaults" ADD CONSTRAINT "proposal_defaults_coverEmpresaPdfAttachmentId_fkey" FOREIGN KEY ("coverEmpresaPdfAttachmentId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

