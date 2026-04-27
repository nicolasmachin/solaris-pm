-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANCO', 'EFECTIVO', 'TARJETA', 'OTRO');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'account';

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "AccountType" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fechaSaldoInicial" DATE,
    "notas" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_activa_idx" ON "accounts"("activa");

-- CreateIndex
CREATE INDEX "accounts_tipo_idx" ON "accounts"("tipo");

-- CreateIndex
CREATE INDEX "payments_accountId_idx" ON "payments"("accountId");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
