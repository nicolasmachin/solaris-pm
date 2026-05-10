-- CreateEnum
CREATE TYPE "FixedCostPeriodicity" AS ENUM ('MENSUAL', 'BIMENSUAL', 'ANUAL');

-- CreateTable
CREATE TABLE "fixed_costs" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "periodicidad" "FixedCostPeriodicity" NOT NULL,
    "diaDelMes" INTEGER NOT NULL,
    "mesesPares" BOOLEAN,
    "mesAnual" INTEGER,
    "montoReferencia" DECIMAL(12,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'UYU',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fixed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fixed_costs_activo_idx" ON "fixed_costs"("activo");

-- CreateIndex
CREATE INDEX "fixed_costs_deletedAt_idx" ON "fixed_costs"("deletedAt");

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN "fixedCostId" TEXT;

-- CreateIndex
CREATE INDEX "finance_movements_fixedCostId_idx" ON "finance_movements"("fixedCostId");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_fixedCostId_fkey" FOREIGN KEY ("fixedCostId") REFERENCES "fixed_costs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
