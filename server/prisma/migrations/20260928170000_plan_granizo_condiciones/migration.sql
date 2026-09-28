-- CreateEnum
CREATE TYPE "PlanGranizoVersionStatus" AS ENUM ('PUBLISHED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'plan_granizo_draft_updated';
ALTER TYPE "AuditAction" ADD VALUE 'plan_granizo_version_published';
ALTER TYPE "AuditAction" ADD VALUE 'plan_granizo_version_discarded';
ALTER TYPE "AuditAction" ADD VALUE 'plan_granizo_version_restored';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'plan_granizo_documento';

-- AlterTable
ALTER TABLE "seguro_granizo_periodos" ADD COLUMN     "inicioAlPagar" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "seguro_granizo_polizas" ADD COLUMN     "anexoFileId" TEXT,
ADD COLUMN     "anexoFirmadoEn" DATE,
ADD COLUMN     "sinCarencia" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "seguro_granizo_siniestros" ADD COLUMN     "eventoMasivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaAviso" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fechaInspeccion" DATE,
ADD COLUMN     "fechaReposicion" DATE,
ADD COLUMN     "financeMovementId" TEXT,
ADD COLUMN     "motivoRechazoCodigo" TEXT,
ADD COLUMN     "panelesRepuestos" INTEGER;

-- CreateTable
CREATE TABLE "plan_granizo_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "plan_granizo_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_granizo_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PlanGranizoVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "snapshot" JSONB NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "label" TEXT,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,
    "discardedAt" TIMESTAMPTZ(6),
    "discardedById" TEXT,
    "discardReason" TEXT,

    CONSTRAINT "plan_granizo_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_granizo_drafts_projectId_key" ON "plan_granizo_drafts"("projectId");

-- CreateIndex
CREATE INDEX "plan_granizo_versions_projectId_status_idx" ON "plan_granizo_versions"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_granizo_versions_projectId_versionNumber_key" ON "plan_granizo_versions"("projectId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_siniestros_financeMovementId_key" ON "seguro_granizo_siniestros"("financeMovementId");

-- AddForeignKey
ALTER TABLE "seguro_granizo_siniestros" ADD CONSTRAINT "seguro_granizo_siniestros_financeMovementId_fkey" FOREIGN KEY ("financeMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_granizo_drafts" ADD CONSTRAINT "plan_granizo_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_granizo_versions" ADD CONSTRAINT "plan_granizo_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

