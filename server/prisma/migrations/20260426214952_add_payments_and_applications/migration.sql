/*
  Warnings:

  - You are about to drop the `finance_payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'payment';
ALTER TYPE "AuditEntityType" ADD VALUE 'payment_application';

-- AlterEnum
ALTER TYPE "FinanceMovementStatus" ADD VALUE 'PARCIALMENTE_PAGADO';

-- DropForeignKey
ALTER TABLE "finance_payments" DROP CONSTRAINT "finance_payments_movimientoId_fkey";

-- DropForeignKey
ALTER TABLE "finance_payments" DROP CONSTRAINT "finance_payments_supplierId_fkey";

-- DropTable
DROP TABLE "finance_payments";

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "metodo" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "referencia" TEXT,
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "montoAplicado" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_supplierId_idx" ON "payments"("supplierId");

-- CreateIndex
CREATE INDEX "payments_fecha_idx" ON "payments"("fecha");

-- CreateIndex
CREATE INDEX "payments_deletedAt_idx" ON "payments"("deletedAt");

-- CreateIndex
CREATE INDEX "payment_applications_movementId_idx" ON "payment_applications"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_applications_paymentId_movementId_key" ON "payment_applications"("paymentId", "movementId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "finance_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
