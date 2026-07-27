-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "facturaEmitida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facturaEmitidaEn" TIMESTAMPTZ(6),
ADD COLUMN     "facturaNota" TEXT,
ADD COLUMN     "llevaFactura" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_llevaFactura_idx" ON "projects"("llevaFactura");
