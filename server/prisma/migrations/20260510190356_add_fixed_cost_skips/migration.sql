-- CreateTable
CREATE TABLE "fixed_cost_skips" (
    "id" TEXT NOT NULL,
    "fixedCostId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_cost_skips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixed_cost_skips_fixedCostId_mes_anio_key" ON "fixed_cost_skips"("fixedCostId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "fixed_cost_skips" ADD CONSTRAINT "fixed_cost_skips_fixedCostId_fkey" FOREIGN KEY ("fixedCostId") REFERENCES "fixed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
