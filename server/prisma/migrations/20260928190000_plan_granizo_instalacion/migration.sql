-- AlterTable
ALTER TABLE "seguro_granizo_polizas" ADD COLUMN     "inversorSerie" TEXT;

-- CreateTable
CREATE TABLE "seguro_granizo_ampliaciones" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "paneles" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "meses" INTEGER NOT NULL,
    "montoUsd" DECIMAL(12,2) NOT NULL,
    "financeMovementId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguro_granizo_ampliaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_ampliaciones_financeMovementId_key" ON "seguro_granizo_ampliaciones"("financeMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_ampliaciones_polizaId_projectId_key" ON "seguro_granizo_ampliaciones"("polizaId", "projectId");

-- AddForeignKey
ALTER TABLE "seguro_granizo_ampliaciones" ADD CONSTRAINT "seguro_granizo_ampliaciones_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "seguro_granizo_polizas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguro_granizo_ampliaciones" ADD CONSTRAINT "seguro_granizo_ampliaciones_financeMovementId_fkey" FOREIGN KEY ("financeMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

