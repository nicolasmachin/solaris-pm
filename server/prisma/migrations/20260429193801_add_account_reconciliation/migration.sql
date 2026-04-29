-- AlterEnum
ALTER TYPE "CategoriaPrincipal" ADD VALUE 'AJUSTE_CONCILIACION';

-- CreateTable
CREATE TABLE "account_reconciliations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "saldoReal" DECIMAL(14,2) NOT NULL,
    "saldoCalculado" DECIMAL(14,2) NOT NULL,
    "diferencia" DECIMAL(14,2) NOT NULL,
    "ajusteMovementId" TEXT,
    "notas" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_reconciliations_ajusteMovementId_key" ON "account_reconciliations"("ajusteMovementId");

-- CreateIndex
CREATE INDEX "account_reconciliations_accountId_fecha_idx" ON "account_reconciliations"("accountId", "fecha");

-- CreateIndex
CREATE INDEX "account_reconciliations_createdAt_idx" ON "account_reconciliations"("createdAt");

-- AddForeignKey
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_ajusteMovementId_fkey" FOREIGN KEY ("ajusteMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
