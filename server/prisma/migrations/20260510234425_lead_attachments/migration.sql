-- DropForeignKey (vamos a re-crearla con la columna nullable)
ALTER TABLE "file_attachments" DROP CONSTRAINT "file_attachments_projectId_fkey";

-- AlterTable: projectId pasa a opcional, agregamos leadId
ALTER TABLE "file_attachments" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "file_attachments" ADD COLUMN "leadId" TEXT;

-- CreateIndex
CREATE INDEX "file_attachments_leadId_idx" ON "file_attachments"("leadId");

-- AddForeignKey: re-crear la FK de projectId ahora nullable
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FK nueva a sales_leads
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
