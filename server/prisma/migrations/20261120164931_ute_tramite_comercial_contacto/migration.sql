-- AlterTable
ALTER TABLE "ute_tramites_comerciales" ADD COLUMN     "contactoId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ute_tramites_comerciales_contactoId_idx" ON "ute_tramites_comerciales"("contactoId");

-- AddForeignKey
ALTER TABLE "ute_tramites_comerciales" ADD CONSTRAINT "ute_tramites_comerciales_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
