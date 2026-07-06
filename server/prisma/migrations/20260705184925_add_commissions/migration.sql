-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDIENTE', 'PAGADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'commission_created';
ALTER TYPE "AuditAction" ADD VALUE 'commission_paid';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'commission';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'COMISIONES';

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "proposalVersionId" TEXT,
    "proposalGenerationId" TEXT,
    "montoUsd" DECIMAL(14,2) NOT NULL,
    "porcentaje" DECIMAL(6,4),
    "origenManual" BOOLEAN NOT NULL DEFAULT false,
    "fechaVenta" TIMESTAMPTZ(6) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMPTZ(6),
    "financeMovementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_leadId_key" ON "commissions"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_financeMovementId_key" ON "commissions"("financeMovementId");

-- CreateIndex
CREATE INDEX "commissions_asesorId_idx" ON "commissions"("asesorId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_fechaVenta_idx" ON "commissions"("fechaVenta");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_proposalVersionId_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_v2_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_financeMovementId_fkey" FOREIGN KEY ("financeMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
