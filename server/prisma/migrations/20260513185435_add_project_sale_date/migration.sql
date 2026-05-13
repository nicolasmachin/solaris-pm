-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "saleDate" DATE;

-- Backfill: proyectos existentes adoptan la fecha de creación como fecha de venta.
UPDATE "projects" SET "saleDate" = "createdAt"::date WHERE "saleDate" IS NULL;

-- CreateIndex
CREATE INDEX "projects_saleDate_idx" ON "projects"("saleDate");
