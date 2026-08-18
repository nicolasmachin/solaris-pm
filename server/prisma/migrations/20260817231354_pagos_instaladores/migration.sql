-- CreateEnum
CREATE TYPE "InstallerPaymentStatus" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'installer_payment';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'PAGOS_INSTALADOR';

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "installerPaymentId" TEXT;

-- CreateTable
CREATE TABLE "installer_payments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "concepto" TEXT,
    "installerId" TEXT,
    "montoUsd" DECIMAL(14,2) NOT NULL,
    "proposalVersionId" TEXT,
    "origenManual" BOOLEAN NOT NULL DEFAULT false,
    "montoEditado" BOOLEAN NOT NULL DEFAULT false,
    "fechaTrabajo" TIMESTAMPTZ(6) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "InstallerPaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMPTZ(6),
    "notas" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "installer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installer_payments_projectId_key" ON "installer_payments"("projectId");

-- CreateIndex
CREATE INDEX "installer_payments_installerId_idx" ON "installer_payments"("installerId");

-- CreateIndex
CREATE INDEX "installer_payments_status_idx" ON "installer_payments"("status");

-- CreateIndex
CREATE INDEX "installer_payments_fechaTrabajo_idx" ON "installer_payments"("fechaTrabajo");

-- CreateIndex
CREATE INDEX "installer_payments_deletedAt_idx" ON "installer_payments"("deletedAt");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_installerPaymentId_fkey" FOREIGN KEY ("installerPaymentId") REFERENCES "installer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installer_payments" ADD CONSTRAINT "installer_payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installer_payments" ADD CONSTRAINT "installer_payments_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installer_payments" ADD CONSTRAINT "installer_payments_proposalVersionId_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_v2_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installer_payments" ADD CONSTRAINT "installer_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
